// Step Function to orchestrate AgentCore Runtime with Lambda intermediary

import * as cdk from 'aws-cdk-lib';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as tasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import * as bedrockagentcore from 'aws-cdk-lib/aws-bedrockagentcore';
import * as path from 'path';

interface StepFunctionStackProps extends cdk.StackProps {
  prefix: string;
  agentRuntime: bedrockagentcore.CfnRuntime;
}

export class StepFunctionStack extends cdk.Stack {
  public readonly stateMachine: sfn.StateMachine;

  constructor(scope: Construct, id: string, props: StepFunctionStackProps) {
    super(scope, id, props);

    // AWS Lambda Powertools Layer V3 for Python 3.13
    const powertoolsLayer = lambda.LayerVersion.fromLayerVersionArn(
      this,
      `${props.prefix}-powertools-layer`,
      `arn:aws:lambda:${this.region}:017000801446:layer:AWSLambdaPowertoolsPythonV3-python313-x86_64:18`
    );

    // Create Lambda function to invoke AgentCore Runtime with callback support
    const agentInvokerFunction = new lambda.Function(this, 'AgentInvokerFunction', {
      runtime: lambda.Runtime.PYTHON_3_13,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../src/lambdas/invoke-agentcore-runtime')),
      layers: [powertoolsLayer],
      timeout: cdk.Duration.minutes(1),  // Short timeout since we are not waiting for agent response
    });

    // Grant Lambda permission to invoke AgentCore Runtime
    agentInvokerFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['bedrock-agentcore:InvokeAgentRuntime'],
        resources: [
          props.agentRuntime.attrAgentRuntimeArn,
          `${props.agentRuntime.attrAgentRuntimeArn}/runtime-endpoint/*`,
        ],
      })
    );

    // Grant Lambda permission to send Step Functions callbacks (for error handling)
    agentInvokerFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['states:SendTaskSuccess', 'states:SendTaskFailure'],
        resources: ['*'],
      })
    );

    // Create the Lambda invocation task with callback pattern
    const invokeAgentTask = new tasks.LambdaInvoke(this, 'InvokeAgentCoreRuntime', {
      lambdaFunction: agentInvokerFunction,
      payload: sfn.TaskInput.fromObject({
        'prompt.$': '$.prompt',
        'taskToken': sfn.JsonPath.taskToken,
        'agentRuntimeArn': props.agentRuntime.attrAgentRuntimeArn,
      }),
      integrationPattern: sfn.IntegrationPattern.WAIT_FOR_TASK_TOKEN,
      resultPath: '$.agentResult',
    });

    // Define the state machine
    this.stateMachine = new sfn.StateMachine(this, 'AgentCoreStateMachine', {
      stateMachineName: `${props.prefix}-agentcore-workflow`,
      definitionBody: sfn.DefinitionBody.fromChainable(invokeAgentTask),
      timeout: cdk.Duration.minutes(15),
    });

    // Outputs
    new cdk.CfnOutput(this, 'StateMachineArn', {
      value: this.stateMachine.stateMachineArn,
      description: 'ARN of the Step Functions State Machine',
      exportName: `${this.stackName}-StateMachineArn`,
    });
  }
}