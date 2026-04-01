// Creates AgentCore Runtime with Step Function callback support

import * as cdk from 'aws-cdk-lib';
import * as bedrockagentcore from 'aws-cdk-lib/aws-bedrockagentcore';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ecr_assets from 'aws-cdk-lib/aws-ecr-assets';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import * as path from 'path';

interface AgentCoreStackProps extends cdk.StackProps {
    prefix: string;
    inferenceProfileArn: string;
}

export class AgentCoreStack extends cdk.Stack {
    public readonly agentCoreRuntime: bedrockagentcore.CfnRuntime;

    constructor(scope: Construct, id: string, props: AgentCoreStackProps) {
        super(scope, id, props);

        const region = cdk.Stack.of(this).region;
        const accountId = cdk.Stack.of(this).account;
        
        // Build Docker image from src/agents/hello-world
        const dockerImage = new ecr_assets.DockerImageAsset(this, 'AgentDockerImage', {
            directory: path.join(__dirname, '../src/agents/hello-world'),
            platform: ecr_assets.Platform.LINUX_ARM64,
        });

        // Create IAM role for AgentCore Runtime
        const runtimePolicy = new iam.PolicyDocument({
            statements: [
                new iam.PolicyStatement({
                    sid: 'ECRImageAccess',
                    effect: iam.Effect.ALLOW,
                    actions: ['ecr:BatchGetImage', 'ecr:GetDownloadUrlForLayer'],
                    resources: [dockerImage.repository.repositoryArn],
                }),
                new iam.PolicyStatement({
                    sid: 'ECRTokenAccess',
                    effect: iam.Effect.ALLOW,
                    actions: ['ecr:GetAuthorizationToken'],
                    resources: ['*'],
                }),
                new iam.PolicyStatement({
                    effect: iam.Effect.ALLOW,
                    actions: ['logs:DescribeLogStreams', 'logs:CreateLogGroup'],
                    resources: [
                        `arn:aws:logs:${region}:${accountId}:log-group:/aws/bedrock-agentcore/runtimes/*`,
                    ],
                }),
                new iam.PolicyStatement({
                    effect: iam.Effect.ALLOW,
                    actions: ['logs:DescribeLogGroups'],
                    resources: [`arn:aws:logs:${region}:${accountId}:log-group:*`],
                }),
                new iam.PolicyStatement({
                    effect: iam.Effect.ALLOW,
                    actions: ['logs:CreateLogStream', 'logs:PutLogEvents'],
                    resources: [
                        `arn:aws:logs:${region}:${accountId}:log-group:/aws/bedrock-agentcore/runtimes/*:log-stream:*`,
                    ],
                }),
                new iam.PolicyStatement({
                    effect: iam.Effect.ALLOW,
                    actions: [
                        'xray:PutTraceSegments',
                        'xray:PutTelemetryRecords',
                        'xray:GetSamplingRules',
                        'xray:GetSamplingTargets',
                    ],
                    resources: ['*'],
                }),
                new iam.PolicyStatement({
                    effect: iam.Effect.ALLOW,
                    actions: ['cloudwatch:PutMetricData'],
                    resources: ['*'],
                    conditions: {
                        StringEquals: { 'cloudwatch:namespace': 'bedrock-agentcore' },
                    },
                }),
                new iam.PolicyStatement({
                    sid: 'BedrockModelInvocation',
                    effect: iam.Effect.ALLOW,
                    actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
                    resources: [
                        `arn:aws:bedrock:*::foundation-model/*`,
                        props.inferenceProfileArn,
                    ],
                }),
                new iam.PolicyStatement({
                    sid: 'StepFunctionsCallback',
                    effect: iam.Effect.ALLOW,
                    actions: ['states:SendTaskSuccess', 'states:SendTaskFailure'],
                    resources: ['*'],
                }),
            ],
        });

        const runtimeRole = new iam.Role(this, 'AgentCoreRuntimeRole', {
            assumedBy: new iam.ServicePrincipal('bedrock-agentcore.amazonaws.com'),
            description: 'IAM role for Bedrock AgentCore Runtime',
            inlinePolicies: {
                RuntimeAccessPolicy: runtimePolicy,
            },
        });

        // Create AgentCore Runtime
        // Runtime name pattern: [a-zA-Z][a-zA-Z0-9_]{0,47} - only letters, numbers, underscores
        const sanitizedPrefix = props.prefix.replace(/[^a-zA-Z0-9_]/g, '_');

        this.agentCoreRuntime = new bedrockagentcore.CfnRuntime(this, 'AgentCoreRuntime', {
            agentRuntimeArtifact: {
                containerConfiguration: {
                    containerUri: dockerImage.imageUri,
                },
            },
            agentRuntimeName: `${sanitizedPrefix}HelloWorldAgent`,
            protocolConfiguration: 'HTTP',
            networkConfiguration: {
                networkMode: 'PUBLIC',
            },
            roleArn: runtimeRole.roleArn,
            environmentVariables: {
                AWS_REGION: region,
                INFERENCE_PROFILE_ARN: props.inferenceProfileArn
            }
        });

        new cdk.CfnOutput(this, 'AgentRuntimeId', {
            value: this.agentCoreRuntime.attrAgentRuntimeId,
            description: 'ID of the AgentCore Runtime',
        });
    }
}
