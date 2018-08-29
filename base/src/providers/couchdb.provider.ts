import { Provider } from "./provider";
import { SystemCheckResult } from "../system.check.result";

class CouchDBProvider extends Provider {
  constructor() {
    super();
  }

  config(): Object {
    return {};
  }

  displayName(): string {
    return "CouchDB";
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

export default CouchDBProvider;
