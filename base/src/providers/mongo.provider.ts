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
    return { success: true };
  }

  async performBackup(): Promise<string> {
    return "";
  }

  testBackup() {}

  restore() {}
}

export default MongoProvider;
