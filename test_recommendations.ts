import { listAllDocuments } from "./lib/paperless";
import { readTasks } from "./lib/tasks";
import { readLineItems } from "./lib/line-items";
import { readVendors } from "./lib/vendors";
import { getSmartActions } from "./lib/recommendations";

(async () => {
  try {
    const [docs, tasks, lineItems, vendors] = await Promise.all([
      listAllDocuments(),
      readTasks(),
      readLineItems(),
      readVendors()
    ]);
    console.log("Documents count:", docs.length);
    console.log("Tasks count:", tasks.length);
    console.log("LineItems count:", lineItems.length);
    console.log("Vendors count:", vendors.length);

    const docWithCorrespondent = docs.find(d => d.correspondent !== null);
    if (!docWithCorrespondent) {
      console.log("No document with correspondent found");
    } else {
      console.log("Testing with document:", docWithCorrespondent.title, "Corresp:", docWithCorrespondent.correspondent);
      const actions = getSmartActions(docWithCorrespondent, tasks, vendors, lineItems);
      console.log("Smart actions found:", actions.length);
      if (actions.length === 0) {
        console.log("No actions. Correspondent ID:", docWithCorrespondent.correspondent);
        console.log("Vendors matching IDs:", vendors.map(v => v.paperless_correspondent_id));
      }
    }
  } catch (e) {
    console.error(e);
  }
})();
