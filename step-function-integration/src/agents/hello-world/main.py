import os
import json
import boto3
import threading
import time
from strands import Agent
from strands.models import BedrockModel
from bedrock_agentcore.runtime import BedrockAgentCoreApp

app = BedrockAgentCoreApp()

# Get inference profile and region from environment
inference_profile_arn = os.environ.get('INFERENCE_PROFILE_ARN', 'us.amazon.nova-pro-v1:0')
aws_region = os.environ.get('AWS_REGION', 'us-east-1')

bedrock_model = BedrockModel(
    model_id=inference_profile_arn
)

def create_agent():
    agent = Agent(model=bedrock_model)
    return agent

def process_agent_async(prompt, task_token):
    """
    Process the agent request asynchronously in a background thread.
    This allows the main entrypoint to return immediately.
    """
    try:
        # Create and run agent
        agent = create_agent()
        response = agent(prompt)
        
        # Prepare result
        result = {
            "response": str(response),
            "prompt": prompt
        }
        
        # Send success to Step Functions
        sfn_client = boto3.client('stepfunctions', region_name=aws_region)
        sfn_client.send_task_success(
            taskToken=task_token,
            output=json.dumps(result)
        )
        
        print(f"Successfully processed prompt and sent result to Step Functions")
        
    except Exception as e:
        print(f"Error in async processing: {e}")
        # Send failure to Step Functions
        try:
            sfn_client = boto3.client('stepfunctions', region_name=aws_region)
            sfn_client.send_task_failure(
                taskToken=task_token,
                error='AgentExecutionError',
                cause=str(e)
            )
        except Exception as callback_error:
            print(f"Failed to send task failure: {callback_error}")

@app.entrypoint
def invoke(payload, context=None):
    """
    Entrypoint for AgentCore Runtime.
    Receives payload with prompt and taskToken from Step Functions.
    Returns immediately while processing continues in background.
    """
    try:
        # Extract prompt and task token
        prompt = payload.get('prompt', 'Hello!')
        task_token = payload.get('taskToken')
        
        if not task_token:
            return {"error": "Missing taskToken in payload"}
        
        # Start async task tracking
        task_id = app.add_async_task("agent_processing", {
            "prompt": prompt,
            "task_token": task_token
        })
        
        # Start background processing in a separate thread
        def background_work():
            try:
                process_agent_async(prompt, task_token)
            finally:
                # Mark task as complete
                app.complete_async_task(task_id)
        
        threading.Thread(target=background_work, daemon=True).start()
        
        # Return immediately with acknowledgment
        return {
            "status": "processing",
            "message": "Agent processing started in background",
            "task_id": task_id
        }
        
    except Exception as e:
        print(f"Error in entrypoint: {e}")
        # If we can't start async processing, send failure immediately
        if 'task_token' in locals() and task_token:
            try:
                sfn_client = boto3.client('stepfunctions', region_name=aws_region)
                sfn_client.send_task_failure(
                    taskToken=task_token,
                    error='AgentStartupError',
                    cause=str(e)
                )
            except Exception as callback_error:
                print(f"Failed to send task failure: {callback_error}")
        
        return {"error": str(e)}

if __name__ == "__main__":
    app.run()