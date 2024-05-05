import { ChatOpenAI } from "@langchain/openai";


export const exampleOctoAI = async () => {
  if (!process.env.OCTOAI_API_KEY) {
    throw new Error("Please provide the OCTOAI_API_KEY environment variable");
  }

  const octoAIModel = new ChatOpenAI({
    configuration: {
      baseURL: "https://text.octoai.run/v1",
      apiKey: process.env.OCTOAI_API_KEY,
    },
    cache,
    temperature: 0.4,
    modelName: 'nous-hermes-2-mixtral-8x7b-dpo',
  })

  const response = await octoAIModel.invoke("What is the meaning of life?");

  return response;
}