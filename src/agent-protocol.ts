import Agent, {
  StepResult,
  type StepHandler,
  type StepInput,
  type TaskInput,
} from 'agent-protocol'
import { Agent as PolyGPTAgent } from "./";

export function integrateAgentProtocol() {
  Agent.handleTask(async (taskInput: TaskInput | null): Promise<StepHandler> => {
    if (taskInput === null) {
      throw new Error('No task prompt');
    }

    const agent = await PolyGPTAgent.create();
    let iterator = agent.run(taskInput);
  
    async function stepHandler(stepInput: StepInput | null): Promise<StepResult> {
      let result = iterator.next(stepInput);

      if (!result.done) {
        return {
          is_last: false,
        };
      } else {
        return {
          is_last: true,
          output: result.value,
        };
      }
    }
  
    return stepHandler;
  }).start();
}
