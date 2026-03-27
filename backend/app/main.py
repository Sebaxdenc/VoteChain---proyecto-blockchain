from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from .fabric_service import submit_vote, get_all_votes

app = FastAPI(title="VoteChain API Gateway - Hyperledger Fabric")

# Habilitar CORS para permitir llamadas desde el frontend web
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class VoteRequest(BaseModel):
    student_hash: str
    candidate: str

@app.post("/votar")
def cast_vote(vote: VoteRequest):
    """
    Recibe el Hash ZKP del estudiante y el candidato.
    Se comunica con Fabric para crear el Asset.
    Si el Asset (ID hash) ya existe, retornará error 400.
    """
    success, message = submit_vote(vote.student_hash, vote.candidate)
    
    if not success:
        # Se envía 400 explícito para avisar del Doble Voto
        raise HTTPException(status_code=400, detail=message)
        
    return {
        "status": "success",
        "message": "¡Consenso alcanzado en Org1 y Org2!",
        "transaction_details": message
    }

@app.get("/resultados")
def fetch_results():
    """
    Obtiene todos los Assets de Fabric y los agrupa por candidato para devolver el conteo.
    """
    success, data = get_all_votes()
    
    if not success:
        raise HTTPException(status_code=500, detail=data)
    
    # Filtrar agrupando únicamente aquellos activos que hemos firmado como "VOTO"
    counts = {}
    for asset in data:
        if asset.get("Color") == "VOTO":
            candidate = asset.get("Owner", "Desconocido")
            counts[candidate] = counts.get(candidate, 0) + 1
            
    return {
        "status": "success",
        "conteo": counts,
        "registros_totales": len(counts)
    }

@app.get("/bloques")
def get_blocks():
    """
    Opcional: Endpoint que retorna un listado en crudo de los últimos activos grabados, 
    simulando un bloque en el frontend.
    """
    success, data = get_all_votes()
    if not success:
        raise HTTPException(status_code=500, detail=data)
    
    # Formateamos solo para uso visual del explorador
    recent_transactions = [
        {"tx_id": asset.get("ID"), "candidato": asset.get("Owner")} 
        for asset in data if asset.get("Color") == "VOTO"
    ]
    
    return recent_transactions
