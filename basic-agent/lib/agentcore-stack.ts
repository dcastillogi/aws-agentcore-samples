// Creates the AgentCore Runtime for direct synchronous invocation

import * as cdk from 'aws-cdk-lib';
import * as bedrockagentcore from 'aws-cdk-lib/aws-bedrockagentcore';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ecr_assets from 'aws-cdk-lib/aws-ecr-assets';
import { Construct } from 'constructs';
import * as path from 'path';
import { getAgentPolicyStatements } from './agent-permissions';

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

    const dockerImage = new ecr_assets.DockerImageAsset(this, 'AgentDockerImage', {
      directory: path.join(__dirname, '../src/agents/basic-agent'),
      platform: ecr_assets.Platform.LINUX_ARM64,
    });

    const runtimePolicy = new iam.PolicyDocument({
      statements: getAgentPolicyStatements({
        region,
        accountId,
        ecrRepositoryArn: dockerImage.repository.repositoryArn,
        inferenceProfileArn: props.inferenceProfileArn,
      }),
    });

    const runtimeRole = new iam.Role(this, 'AgentCoreRuntimeRole', {
      assumedBy: new iam.ServicePrincipal('bedrock-agentcore.amazonaws.com'),
      description: 'IAM role for Bedrock AgentCore Runtime',
      inlinePolicies: {
        RuntimeAccessPolicy: runtimePolicy,
      },
    });

    const sanitizedPrefix = props.prefix.replace(/[^a-zA-Z0-9_]/g, '_');

    this.agentCoreRuntime = new bedrockagentcore.CfnRuntime(this, 'AgentCoreRuntime', {
      agentRuntimeArtifact: {
        containerConfiguration: {
          containerUri: dockerImage.imageUri,
        },
      },
      agentRuntimeName: `${sanitizedPrefix}BasicAgent`,
      protocolConfiguration: 'HTTP',
      networkConfiguration: {
        networkMode: 'PUBLIC',
      },
      roleArn: runtimeRole.roleArn,
      environmentVariables: {
        AWS_REGION: region,
        INFERENCE_PROFILE_ARN: props.inferenceProfileArn,
      },
    });

    new cdk.CfnOutput(this, 'AgentRuntimeId', {
      value: this.agentCoreRuntime.attrAgentRuntimeId,
      description: 'ID of the AgentCore Runtime — use this to invoke the agent',
    });

    new cdk.CfnOutput(this, 'AgentRuntimeArn', {
      value: this.agentCoreRuntime.attrAgentRuntimeArn,
      description: 'ARN of the AgentCore Runtime',
    });
  }
}
