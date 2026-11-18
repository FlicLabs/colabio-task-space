// The wrapper is app-owned. Personal HTML runs only in its nested opaque-origin frame.
// The wrapper's frame-src policy also blocks that nested frame navigating to a network URL.
export const HOSTED_FRAME_CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; frame-src blob:; connect-src 'none'; object-src 'none'; worker-src 'none'; form-action 'none'; base-uri 'none'; sandbox allow-scripts";
const INNER_CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; frame-src 'none'; connect-src 'none'; object-src 'none'; worker-src 'none'; form-action 'none'; base-uri 'none'";

function childBoot(channel) {
  let model = null;
  const listeners = new Set();
  const send = (kind, fields = {}) => parent.postMessage({ channel, kind, ...fields }, "*");
  Object.defineProperty(window, "colabio", { value: Object.freeze({
    onTasks(callback) { listeners.add(callback); if (model) callback(model); return () => listeners.delete(callback); },
    openTask(taskId) { send("open-task", { taskId }); },
    createTask() { send("create-task"); },
  }), writable: false, configurable: false });
  addEventListener("message", (event) => {
    if (event.source !== parent || event.data?.channel !== channel || event.data.kind !== "model") return;
    model = event.data.model;
    for (const callback of listeners) { try { callback(model); } catch { send("view-error"); } }
  });
  addEventListener("error", () => send("view-error"));
  addEventListener("unhandledrejection", () => send("view-error"));
  let lastHeight = 0;
  addEventListener("DOMContentLoaded", () => {
    new ResizeObserver(() => {
      const height = Math.max(280, Math.min(8000, document.documentElement.scrollHeight));
      if (height !== lastHeight) { lastHeight = height; send("height", { height }); }
    }).observe(document.documentElement);
    send("ready");
  });
}

export function hostedWrapperHtml() {
  const boot = childBoot.toString();
  return `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;width:100%;height:100%;overflow:hidden}iframe{display:block;width:100%;height:100%;border:0}</style></head><body><iframe id="view" title="Your custom task view" sandbox="allow-scripts" allow="camera 'none'; microphone 'none'; geolocation 'none'; clipboard-read 'none'; clipboard-write 'none'"></iframe><script>
    const frame = document.getElementById('view');
    let hostChannel = null, childChannel = null, model = null, url = null;
    const toChild = () => frame.contentWindow.postMessage({channel:childChannel,kind:'model',model}, '*');
    addEventListener('message', event => {
      const data = event.data;
      if (!data || typeof data !== 'object') return;
      if (event.source === parent && data.kind === 'init' && typeof data.channel === 'string' && typeof data.html === 'string') {
        hostChannel = data.channel; childChannel = crypto.randomUUID(); model = data.model;
        if (url) URL.revokeObjectURL(url);
        const prefix = '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="' + ${JSON.stringify(INNER_CSP)} + '"><scr' + 'ipt>(' + ${JSON.stringify(boot)} + ')(' + JSON.stringify(childChannel) + ')</scr' + 'ipt>';
        url = URL.createObjectURL(new Blob([prefix, data.html], {type:'text/html'}));
        frame.src = url;
      } else if (event.source === parent && data.channel === hostChannel && data.kind === 'model') {
        model = data.model; toChild();
      } else if (event.source === frame.contentWindow && data.channel === childChannel) {
        if (data.kind === 'ready') toChild();
        if (['ready','open-task','create-task','view-error','height'].includes(data.kind)) {
          parent.postMessage({channel:hostChannel,kind:data.kind,taskId:data.taskId,height:data.height}, '*');
        }
      }
    });
    parent.postMessage({kind:'wrapper-ready'}, '*');
  </script></body></html>`;
}
