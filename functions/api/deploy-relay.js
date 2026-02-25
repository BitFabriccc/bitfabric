import { AwsClient } from 'aws4fetch';

export async function onRequestPost({ request, env }) {
    try {
        const { email, deployId } = await request.json();

        if (!email || !deployId) {
            return Response.json({ error: 'Missing parameters' }, { status: 400 });
        }

        // Initialize AWS client
        // Note: requires AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in env
        const aws = new AwsClient({
            accessKeyId: env.AWS_ACCESS_KEY_ID,
            secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
            region: env.AWS_REGION || 'us-east-1'
        });

        // We will deploy a t4g.nano (ARM) instance using Amazon Linux 2023 or similar AMI
        // AMI ID needs to be dynamically fetched or hardcoded for the region region (e.g. ami-0c4e1ebd0af0b2302 for AL2023 ARM in us-east-1)
        // To simplify, we use a known ARM64 Amazon Linux 2023 AMI in us-east-1:
        const AMI_ID = env.AWS_AMI_ID || 'ami-0c4e1ebd0af0b2302'; // Update this to match your region
        const SECURITY_GROUP_ID = env.AWS_SECURITY_GROUP_ID; // Needs a SG that allows ports 22, 80, 443, 8080
        const SUBNET_ID = env.AWS_SUBNET_ID;

        // User data script to install Docker and run a simple Nostr relay (scsibug/nostr-rs-relay)
        const userDataStr = `#!/bin/bash
yum update -y
yum install -y docker
systemctl start docker
systemctl enable docker
docker run -d --name nostr-relay -p 80:8080 -v /mnt/nostr-data:/usr/src/app/db scsibug/nostr-rs-relay
`;
        const userDataB64 = btoa(userDataStr);

        // Call ec2:RunInstances
        const runParams = new URLSearchParams({
            Action: 'RunInstances',
            Version: '2016-11-15',
            ImageId: AMI_ID,
            InstanceType: 't4g.nano',
            MinCount: '1',
            MaxCount: '1',
            UserData: userDataB64
        });

        if (SECURITY_GROUP_ID) {
            runParams.append('SecurityGroupId.1', SECURITY_GROUP_ID);
        }
        if (SUBNET_ID) {
            runParams.append('SubnetId', SUBNET_ID);
        }

        const ec2Url = `https://ec2.${env.AWS_REGION || 'us-east-1'}.amazonaws.com/`;
        let response = await aws.fetch(ec2Url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: runParams
        });

        let resultText = await response.text();

        if (!response.ok) {
            console.error('AWS EC2 RunInstances failed:', resultText);
            await env.DB.prepare('UPDATE user_relays SET status = ? WHERE id = ?')
                .bind('failed', deployId).run();
            return Response.json({ error: 'AWS provisioning failed' }, { status: 500 });
        }

        // In a real XML parser scenario, we'd extract this properly.
        // Hacky regex extraction for Cloudflare worker without XML parser library:
        const instanceIdMatch = resultText.match(/<instanceId>(.*?)<\/instanceId>/);
        const instanceId = instanceIdMatch ? instanceIdMatch[1] : null;

        if (!instanceId) {
            console.error('Could not extract instance ID from AWS response');
            await env.DB.prepare('UPDATE user_relays SET status = ? WHERE id = ?')
                .bind('failed', deployId).run();
            return Response.json({ error: 'Failed to assign instance ID' }, { status: 500 });
        }

        // Update D1 with the instance ID
        await env.DB.prepare('UPDATE user_relays SET aws_instance_id = ? WHERE id = ?')
            .bind(instanceId, deployId).run();

        // Ideally, we'd poll or use an AWS Lambda to update the DB once the public IP is assigned.
        // For now, we will wait 5 seconds and attempt to fetch the Public IP via DescribeInstances
        // (AWS usually assigns an IP very quickly if auto-assign public IP is enabled on the subnet)

        // We intentionally delay the worker to grab the IP, though in production an EventBridge + Webhook is safer.
        // Cloudflare workers have CPU limits but can wait on async tasks if bound strictly.
        // Wait for 5 seconds for AWS to assign public IP
        await new Promise(r => setTimeout(r, 5000));

        const describeParams = new URLSearchParams({
            Action: 'DescribeInstances',
            Version: '2016-11-15',
            'InstanceId.1': instanceId
        });

        response = await aws.fetch(ec2Url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: describeParams
        });

        resultText = await response.text();
        const ipMatch = resultText.match(/<ipAddress>(.*?)<\/ipAddress>/);
        const publicIp = ipMatch ? ipMatch[1] : null;

        if (publicIp) {
            const relayUrl = `ws://${publicIp}`;
            await env.DB.prepare('UPDATE user_relays SET status = ?, relay_url = ? WHERE id = ?')
                .bind('active', relayUrl, deployId).run();
        } else {
            // Leave in provisioning state, another script or worker can check on it later
            console.warn('Instance created but IP not retrieved immediately.');
        }

        return Response.json({ success: true, deployId, instanceId });

    } catch (err) {
        console.error('Relay deploy error:', err);
        return Response.json({ error: err.message }, { status: 500 });
    }
}
