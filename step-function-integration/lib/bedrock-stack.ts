// Creates inference profile (useful for cost allocation) and prompt man

import * as cdk from 'aws-cdk-lib';
import * as bedrock from 'aws-cdk-lib/aws-bedrock';
import { Construct } from 'constructs';

interface BedrockStackProps extends cdk.StackProps {
  prefix: string;
  inferenceProfileId: string;
}

export class BedrockStack extends cdk.Stack {
  public readonly inferenceProfileArn: string;

  constructor(scope: Construct, id: string, props: BedrockStackProps) {
    super(scope, id, props);

    const accountId = cdk.Stack.of(this).account;

    // Create Application Inference Profile
    // The copyFrom field requires a full ARN in the format:
    // arn:aws:bedrock:region::foundation-model/model-id
    const sourceInferenceProfileArn = `arn:aws:bedrock:us-east-1:${accountId}:inference-profile/${props.inferenceProfileId}`;

    // Sanitize profile name - only alphanumeric, spaces, underscores, and hyphens allowed
    const sanitizedModelId = props.inferenceProfileId.replace(/[.:]/g, '-');

    const inferenceProfile = new bedrock.CfnApplicationInferenceProfile(this, 'CustomInferenceProfile', {
      inferenceProfileName: `${props.prefix}${sanitizedModelId}-profile`,
      modelSource: {
        copyFrom: sourceInferenceProfileArn,
      },
    });

    this.inferenceProfileArn = inferenceProfile.attrInferenceProfileArn;

    // Export for cross-stack reference
    new cdk.CfnOutput(this, 'InferenceProfileArn', {
      value: this.inferenceProfileArn,
      description: 'ARN of the custom inference profile',
      exportName: `${this.stackName}-InferenceProfileArn`,
    });
  }
}
