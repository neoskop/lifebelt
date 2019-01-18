import { Provider } from "./provider";
import { SystemCheckResult } from "../system.check.result";

class MongoProvider extends Provider {
  constructor() {
    super();
  }

  config(): Object {
    return {};
  }

  displayName(): string {
    return "MongoDB";
  }

  systemCheck(): SystemCheckResult {
    return { success: false };
  }

  async performBackup(): Promise<string> {
    throw new Error('Not yet implemented!');
  }

  testBackup() {
    throw new Error('Not yet implemented!');
  }

  async performRestore() {
    throw new Error('Not yet implemented!');
  }
}

export default MongoProvider;
