// Creates an Application Inference Profile for cost allocation and model access

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

    const sourceInferenceProfileArn = `arn:aws:bedrock:us-east-1:${accountId}:inference-profile/${props.inferenceProfileId}`;
    const sanitizedModelId = props.inferenceProfileId.replace(/[.:]/g, '-');

    const inferenceProfile = new bedrock.CfnApplicationInferenceProfile(this, 'CustomInferenceProfile', {
      inferenceProfileName: `${props.prefix}${sanitizedModelId}-profile`,
      modelSource: {
        copyFrom: sourceInferenceProfileArn,
      },
    });

    this.inferenceProfileArn = inferenceProfile.attrInferenceProfileArn;

    new cdk.CfnOutput(this, 'InferenceProfileArn', {
      value: this.inferenceProfileArn,
      description: 'ARN of the custom inference profile',
      exportName: `${this.stackName}-InferenceProfileArn`,
    });
  }
}
