import os
from strands import Agent
from strands.models import BedrockModel
from bedrock_agentcore.runtime import BedrockAgentCoreApp

app = BedrockAgentCoreApp()

inference_profile_arn = os.environ.get('INFERENCE_PROFILE_ARN')

bedrock_model = BedrockModel(model_id=inference_profile_arn)


@app.entrypoint
def invoke(payload, context=None):
    """
    Entrypoint for AgentCore Runtime.
    Receives a payload with a 'prompt' key and returns the agent's response synchronously.
    """
    prompt = payload.get('prompt', 'Hello!')

    agent = Agent(model=bedrock_model)
    response = agent(prompt)

    return {
        "response": str(response),
        "prompt": prompt,
    }


if __name__ == "__main__":
    app.run()
