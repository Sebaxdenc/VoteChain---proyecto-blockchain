const API_URL = 'http://localhost:8000';
let pollChart;

// 1. Simulación de Zero-Knowledge Proof (Hacheo en Cliente)
async function generateZKP_Hash(voterId) {
    const encoder = new TextEncoder();
    // Añadimos un "salt" de elección para que un estudiante genere el mismo hash en ESTA elección, pero distinto en otras
    const data = encoder.encode(voterId + "-ELECTION-2026");
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    // Retornamos los primeros 32 caracteres para simplificar la visualización del Asset ID
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 32);
}

// 2. Función Principal de Votar
async function castVote(candidate) {
    const studentIdInput = document.getElementById('studentId');
    const rawId = studentIdInput.value.trim();
    
    if (!rawId) {
        alert("Por favor, ingresa tu ID de Estudiante antes de votar.");
        return;
    }

    addLog(`Generando prueba de hash seguro para el ID...`);
    const hashedId = await generateZKP_Hash(rawId);
    addLog(`Hash ZKP generado: ${hashedId}`);
    
    try {
        addLog(`Enviando transacción al canal Hyperledger...`);
        const response = await fetch(`${API_URL}/votar`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                student_hash: `VOTE_${hashedId}`,
                candidate: candidate
            })
        });

        const data = await response.json();

        if (!response.ok) {
            // Manejar error (ej. Doble Voto)
            addLog(`❌ Transacción rechazada org org1/org2: ${data.detail}`, "text-red-400");
            alert(`Error emitido por Smart Contract:\n${data.detail}`);
            return;
        }

        // Éxito - Logging Simulado
        addLog(`✅ ¡Consenso alcanzado en Org1 y Org2!`, "text-green-400 font-bold");
        addLog(`Asset (Voto) insertado en el Ledger exitosamente.`);
        studentIdInput.value = ""; // Limpiamos el input

        // (NUEVO) Generar Recibo Criptográfico para el usuario
        generarReciboCriptografico(hashedId, candidate, data.transaction_details || "TX_MOCKEADA_POR_CLI");

        // Refrescar resultados asincronamente
        setTimeout(fetchResults, 1000);
        setTimeout(fetchRecentBlocks, 1000);

    } catch (error) {
        addLog(`Error de Conexión: La red no pudo lograr el consenso. Revisa el estado de los Peers.`, "text-red-500");
        console.error(error);
    }
}

// NUEVA FUNCIÓN: Descargar PDF/TXT del Recibo Inteligente
function generarReciboCriptografico(hash, candidate, cli_logs) {
    // Tomamos la fecha exacta del voto desde el equipo local
    const fecha = new Date().toISOString();
    
    const textoRecibo = `
=========================================================
     VOTECHAIN - RECIBO DE VOTACIÓN CRIPTOGRÁFICO
=========================================================
Fecha y Hora (UTC)  : ${fecha}
Hash Estudiante (ID): ${hash}
Elección Registrada : ${candidate}
---------------------------------------------------------
Este documento certifica criptográficamente mediante 
Hyperledger Fabric que el voto ha sido contado y es 
INMUTABLE al haber obtenido firma de consenso de nodos.

Log Parcial del Ledger: 
${cli_logs.substring(0, 200)}...
=========================================================
Conserve este archivo. Ninguna autoridad puede 
relacionar su Hash ZKP con su identidad real.
`;

    // Crea un Blob (archivo virtual) y forzamos su descarga
    const blob = new Blob([textoRecibo], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Recibo_VoteChain_${hash.substring(0,6)}.txt`;
    a.click();
    window.URL.revokeObjectURL(url);

    addLog(`🧾 Recibo criptográfico generado y descargado con éxito.`, "text-blue-400");
}

// NUEVA FUNCIÓN: Simulador de Tolerancia a Fallos
async function tumbarRed(estado) {
    // Si estado == true, apagamos peer0.org2. Si es false, lo encendemos.
    const accion = estado ? "apagando" : "encendiendo";
    addLog(`⚠️ Modo Dios: ${accion} Organización 2...`, "text-yellow-500 font-bold");
    
    try {
        const response = await fetch(`${API_URL}/tumbar?status=${estado}`, {
            method: 'POST'
        });
        const result = await response.json();
        addLog(`🔧 Respuesta del Host: ${result.message}`, estado ? "text-red-400" : "text-green-400");
        
        if(estado) {
            alert("Org 2 Tumbada: ¡Intenta votar ahora! Verás cómo el Contrato Inteligente rechaza la transacción porque no puede llegar a ningún consenso sin la validación de la Facultad de Derecho.");
        } else {
            alert("Org 2 Arriba: La red ha sanado. Puedes volver a votar con normalidad.");
        }
    } catch (e) {
        addLog(`Error al manipular el contenedor de Docker.`, "text-red-600");
    }
}

// 3. Sistema de Logs GUI
function addLog(message, classes = "text-green-400") {
    const logContainer = document.getElementById('log-container');
    logContainer.classList.remove('hidden');
    
    const p = document.createElement('p');
    p.className = `mt-1 ${classes}`;
    p.innerHTML = `> [${new Date().toLocaleTimeString()}] ${message}`;
    
    logContainer.appendChild(p);
    logContainer.scrollTop = logContainer.scrollHeight; // Auto-scroll
}

// 4. Obtener Resultados y Renderizar Chart
async function fetchResults() {
    try {
        const response = await fetch(`${API_URL}/resultados`);
        const data = await response.json();

        if(data.status === "success") {
            const counts = data.conteo;
            updateChart(counts);
        }
    } catch (error) {
        console.error("Error al obtener el ledger:", error);
    }
}

function updateChart(counts) {
    const ctx = document.getElementById('resultsChart').getContext('2d');
    
    const labels = Object.keys(counts);
    const votes = Object.values(counts);

    // Asegurarnos que existan las 3 opciones visualmente aunque tengan 0
    const fixedLabels = ["Candidato_A", "Candidato_B", "Voto_Blanco"];
    const fixedData = fixedLabels.map(l => counts[l] || 0);

    if (pollChart) {
        pollChart.data.labels = fixedLabels;
        pollChart.data.datasets[0].data = fixedData;
        pollChart.update();
    } else {
        pollChart = new Chart(ctx, {
            type: 'bar', // Puede cambiarse a 'doughnut' o 'pie'
            data: {
                labels: fixedLabels,
                datasets: [{
                    label: 'Votos Confirmados',
                    data: fixedData,
                    backgroundColor: [
                        'rgba(99, 102, 241, 0.6)',  // Indigo
                        'rgba(34, 197, 94, 0.6)',  // Green
                        'rgba(156, 163, 175, 0.6)' // Gray
                    ],
                    borderColor: [
                        'rgba(99, 102, 241, 1)',
                        'rgba(34, 197, 94, 1)',
                        'rgba(156, 163, 175, 1)'
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true, ticks: { stepSize: 1 } }
                }
            }
        });
    }
}

// 5. Obtener Transacciones Recientes
async function fetchRecentBlocks() {
    try {
        const response = await fetch(`${API_URL}/bloques`);
        const data = await response.json();
        
        const list = document.getElementById('block-list');
        list.innerHTML = "";
        
        if (data.length === 0) {
            list.innerHTML = "<li>No hay transacciones aún.</li>";
            return;
        }

        // Mostrar las últimas 5 invertidas
        const recent = data.slice(-8).reverse();
        recent.forEach(tx => {
            const li = document.createElement('li');
            li.className = "p-2 bg-gray-50 border-b";
            li.innerHTML = `
                <div class="text-indigo-600 font-bold truncate" title="${tx.tx_id}">${tx.tx_id}</div>
                <div class="flex justify-between text-gray-500">
                    <span>${tx.candidato}</span>
                    <span class="text-green-500">✔ Escrito</span>
                </div>
            `;
            list.appendChild(li);
        });

    } catch (error) {
        console.error("Error al obtener bloques:", error);
    }
}

// Inicialización
window.onload = () => {
    fetchResults();
    fetchRecentBlocks();
};
