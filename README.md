# AWS Bedrock AgentCore Samples

Practical examples for deploying and invoking [AWS Bedrock AgentCore](https://docs.aws.amazon.com/bedrock/latest/userguide/agentcore.html) runtimes using AWS CDK.

## Samples

| Sample | Description |
|---|---|
| [basic-agent](./basic-agent) | Minimal AgentCore runtime — deploy a containerized agent and invoke it directly via boto3 or AWS CLI. Good starting point. |
| [step-function-integration](./step-function-integration) | AgentCore runtime orchestrated by AWS Step Functions using the `WAIT_FOR_TASK_TOKEN` pattern for async processing. |
