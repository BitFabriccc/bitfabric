import { AwsClient } from 'aws4fetch';

export async function onRequestPost({ request, env }) {
    try {
        const { deployId, instanceId, email } = await request.json();

        // In a real app we need some authorization header here.
        // E.g. internal API key check.

        if (!deployId || !instanceId || !email) {
            return Response.json({ error: 'Missing parameters' }, { status: 400 });
        }

        const aws = new AwsClient({
            accessKeyId: env.AWS_ACCESS_KEY_ID,
            secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
            region: env.AWS_REGION || 'us-east-1'
        });

        // Call ec2:TerminateInstances
        const params = new URLSearchParams({
            Action: 'TerminateInstances',
            Version: '2016-11-15',
            'InstanceId.1': instanceId
        });

        const ec2Url = `https://ec2.${env.AWS_REGION || 'us-east-1'}.amazonaws.com/`;
        const response = await aws.fetch(ec2Url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params
        });

        const resultText = await response.text();

        if (!response.ok) {
            console.error('AWS EC2 TerminateInstances failed:', resultText);
            return Response.json({ error: 'Failed to terminate AWS instance' }, { status: 500 });
        }

        // Update D1 immediately to terminated
        await env.DB.prepare('UPDATE user_relays SET status = ? WHERE id = ?')
            .bind('terminated', deployId).run();

        return Response.json({ success: true, deployId, status: 'terminated' });

    } catch (err) {
        console.error('Relay termination error:', err);
        return Response.json({ error: err.message }, { status: 500 });
    }
}
