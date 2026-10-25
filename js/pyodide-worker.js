// pyodide-worker.js
importScripts("https://cdn.jsdelivr.net/pyodide/v0.24.1/full/pyodide.js");

let pyodideInstance;

async function initPyodide() {
    self.postMessage({ type: "status", msg: "A iniciar motor científico..." });
    pyodideInstance = await loadPyodide();
    
    // Lazy Loading: Carrega apenas bibliotecas core inicialmente
    await pyodideInstance.loadPackage(["micropip"]);
    const micropip = pyodideInstance.pyimport("micropip");
    
    // Deixa scipy e scikit-learn para serem instalados apenas se houver um import explícito no futuro
    self.postMessage({ type: "ready", msg: "Motor Pyodide pronto." });
}

let pyodideReadyPromise = initPyodide();

self.onmessage = async (event) => {
    await pyodideReadyPromise;
    const { id, pythonCode } = event.data;

    try {
        // Redireciona o stdout (print) de volta para a Main Thread
        pyodideInstance.setStdout({ batched: (msg) => {
            self.postMessage({ type: "stdout", id, result: msg });
        }});
        
        pyodideInstance.setStderr({ batched: (msg) => {
            self.postMessage({ type: "stderr", id, error: msg });
        }});

        // Executa o script de forma isolada
        const output = await pyodideInstance.runPythonAsync(pythonCode);
        self.postMessage({ type: "success", id, result: output });

    } catch (error) {
        self.postMessage({ type: "error", id, error: error.message });
    }
};
