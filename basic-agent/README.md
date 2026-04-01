# Basic AgentCore Agent

A minimal AWS Bedrock AgentCore sample showing how to deploy and invoke an agent runtime directly.

## Architecture

| Resource | Description |
|---|---|
| **AgentCore Runtime** | Runs the containerized Python agent |
| **Application Inference Profile** | Wraps the Bedrock model for cost allocation |
| **ECR** | Stores the agent Docker image (created automatically by CDK) |

## Prerequisites

- AWS CLI configured (`aws configure`)
- Node.js ≥ 18 and npm
- Docker running (for CDK to build the container image)
- CDK bootstrapped in your account/region (`cdk bootstrap`)

## Deploy

```bash
cd basic-agent
npm install
cdk deploy --all
```

CDK will output the Runtime ID and ARN after a successful deploy:

```
Outputs:
AgentCoreStack.AgentRuntimeId  = abc123def456
AgentCoreStack.AgentRuntimeArn = arn:aws:bedrock-agentcore:us-east-1:123456789012:runtime/abc123def456
```

## Invoke the agent

The agent accepts a JSON payload with a single `prompt` key and returns the model's response synchronously.

### boto3 (Python)

```python
import boto3
import json

RUNTIME_ID = "abc123def456"   # from CDK output: AgentCoreStack.AgentRuntimeId
REGION     = "us-east-1"

client = boto3.client("bedrock-agentcore", region_name=REGION)

response = client.invoke_agent_runtime(
    agentRuntimeId=RUNTIME_ID,
    payload=json.dumps({"prompt": "What is the capital of France?"}).encode(),
)

# The response body is a streaming event-stream
result_lines = []
content_type = response.get("contentType", "")

if "text/event-stream" in content_type:
    for line in response["response"].iter_lines(chunk_size=64):
        if line:
            decoded = line.decode("utf-8")
            if decoded.startswith("data: "):
                result_lines.append(decoded[6:])
elif "application/json" in content_type:
    for chunk in response.get("response", []):
        result_lines.append(chunk.decode("utf-8"))

agent_output = json.loads("\n".join(result_lines))
print(agent_output["response"])
```

### AWS CLI

```bash
RUNTIME_ARN="arn:aws:bedrock-agentcore:us-east-1:123456789012:runtime/abc123def456"  # from CDK output: AgentCoreStack.AgentRuntimeArn
REGION="us-east-1"

echo '{"prompt": "What is the capital of France?"}' | base64 > /tmp/payload.json

aws bedrock-agentcore invoke-agent-runtime \
  --agent-runtime-arn "$RUNTIME_ARN" \
  --payload file:///tmp/payload.json \
  --region "$REGION" \
  /dev/stdout
```

## Configuration

Edit `config/config.json` before deploying to change the model or environment prefix:

```json
{
    "inferenceProfile": "us.amazon.nova-2-lite-v1:0",
    "prefix": "dev"
}
```

| Field | Description |
|---|---|
| `inferenceProfile` | Cross-region inference profile ID (must exist in your account) |
| `prefix` | Prepended to all resource names — change per environment |