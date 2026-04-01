import json
import boto3
import uuid
from aws_lambda_powertools import Logger

logger = Logger()

@logger.inject_lambda_context
def handler(event, context):
    # Extract parameters from Step Functions
    prompt = event.get('prompt', '')
    task_token = event.get('taskToken', '')
    agent_runtime_arn = event.get('agentRuntimeArn', '')
    
    # Create BedrockAgentCore client
    client = boto3.client('bedrock-agentcore')
    
    try:
        # Prepare payload for AgentCore Runtime including task token
        payload = json.dumps({
            'prompt': prompt,
            'taskToken': task_token  # Pass task token to agent for callback
        }).encode('utf-8')
        
        # Invoke AgentCore Runtime (agent will return immediately and process async)
        response = client.invoke_agent_runtime(
            agentRuntimeArn=agent_runtime_arn,
            payload=payload
        )
        
        # Process the immediate response from agent
        result_content = []
        if "text/event-stream" in response.get("contentType", ""):
            for line in response["response"].iter_lines(chunk_size=10):
                if line:
                    line = line.decode("utf-8")
                    if line.startswith("data: "):
                        line = line[6:]
                        result_content.append(line)
        elif response.get("contentType") == "application/json":
            for chunk in response.get("response", []):
                result_content.append(chunk.decode('utf-8'))
        
        # Parse the agent's immediate response
        agent_response = '\n'.join(result_content)
        parsed_response = json.loads(agent_response)

        logger.info(f"Agent Response: {parsed_response}")

        status = parsed_response.get('status', 'unknown')
        # If agent does not start processing, fail the task
        if status != "processing":
            raise Exception("Agent did not start processing")
        
    except Exception as e:
        # If invocation fails, send failure to Step Functions
        if task_token:
            stepfunctions = boto3.client('stepfunctions')
            stepfunctions.send_task_failure(
                taskToken=task_token,
                error='AgentInvocationError',
                cause=str(e)
            )