// IAM policy statements for the AgentCore Runtime role.
// Edit this file to add, remove, or modify permissions without touching the stack.

import * as iam from 'aws-cdk-lib/aws-iam';

export interface AgentPermissionsProps {
  region: string;
  accountId: string;
  ecrRepositoryArn: string;
  inferenceProfileArn: string;
}

export function getAgentPolicyStatements(props: AgentPermissionsProps): iam.PolicyStatement[] {
  const { region, accountId, ecrRepositoryArn, inferenceProfileArn } = props;

  return [
    // ── ECR ──────────────────────────────────────────────────────────────────
    new iam.PolicyStatement({
      sid: 'ECRImageAccess',
      effect: iam.Effect.ALLOW,
      actions: ['ecr:BatchGetImage', 'ecr:GetDownloadUrlForLayer'],
      resources: [ecrRepositoryArn],
    }),
    new iam.PolicyStatement({
      sid: 'ECRTokenAccess',
      effect: iam.Effect.ALLOW,
      actions: ['ecr:GetAuthorizationToken'],
      resources: ['*'],
    }),

    // ── CloudWatch Logs ───────────────────────────────────────────────────────
    new iam.PolicyStatement({
      sid: 'CloudWatchLogsDescribe',
      effect: iam.Effect.ALLOW,
      actions: ['logs:DescribeLogStreams', 'logs:CreateLogGroup'],
      resources: [
        `arn:aws:logs:${region}:${accountId}:log-group:/aws/bedrock-agentcore/runtimes/*`,
      ],
    }),
    new iam.PolicyStatement({
      sid: 'CloudWatchLogsDescribeGroups',
      effect: iam.Effect.ALLOW,
      actions: ['logs:DescribeLogGroups'],
      resources: [`arn:aws:logs:${region}:${accountId}:log-group:*`],
    }),
    new iam.PolicyStatement({
      sid: 'CloudWatchLogsPut',
      effect: iam.Effect.ALLOW,
      actions: ['logs:CreateLogStream', 'logs:PutLogEvents'],
      resources: [
        `arn:aws:logs:${region}:${accountId}:log-group:/aws/bedrock-agentcore/runtimes/*:log-stream:*`,
      ],
    }),

    // ── X-Ray ────────────────────────────────────────────────────────────────
    new iam.PolicyStatement({
      sid: 'XRayTracing',
      effect: iam.Effect.ALLOW,
      actions: [
        'xray:PutTraceSegments',
        'xray:PutTelemetryRecords',
        'xray:GetSamplingRules',
        'xray:GetSamplingTargets',
      ],
      resources: ['*'],
    }),

    // ── CloudWatch Metrics ────────────────────────────────────────────────────
    new iam.PolicyStatement({
      sid: 'CloudWatchMetrics',
      effect: iam.Effect.ALLOW,
      actions: ['cloudwatch:PutMetricData'],
      resources: ['*'],
      conditions: {
        StringEquals: { 'cloudwatch:namespace': 'bedrock-agentcore' },
      },
    }),

    // ── Bedrock ───────────────────────────────────────────────────────────────
    new iam.PolicyStatement({
      sid: 'BedrockModelInvocation',
      effect: iam.Effect.ALLOW,
      actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
      resources: [
        'arn:aws:bedrock:*::foundation-model/*',
        inferenceProfileArn,
      ],
    }),
  ];
}
