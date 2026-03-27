import subprocess
import json

def _run_cli_command(command: list):
    try:
        # Ejecuta el comando en el contexto del host, que se comunicará con el daemon de Docker
        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            check=True
        )
        return True, result.stdout
    except subprocess.CalledProcessError as e:
        return False, e.stderr

def submit_vote(student_hash: str, candidate: str):
    """
    Envía un voto 'CreateAsset' al chaincode usando el contenedor CLI.
    En la simulación:
    - ID = student_hash (Para prevenir doble voto gracias a Fabric que no admite Assets con el mismo ID)
    - Color = "VOTO"  (solo sirve como filtro en el main para contar votos, no tiene otra función) 
    - Size = 1        (tampoco sirve de nada, pero es un campo requerido por el chaincode)
    - Owner = candidate
    - AppraisedValue = 1 (tampoco sirve de nada, pero es un campo requerido por el chaincode)
    """
    args_json = json.dumps({
        "function": "CreateAsset",
        "Args": [student_hash, "VOTO", "1", candidate, "1"]
    })
    
    # Comando estándar de Invoke en Fabric test-network para alcanzar consenso (requiere Org1 y Org2)
    cmd = [
        "docker", "exec", "cli",
        "peer", "chaincode", "invoke",
        "-o", "orderer.example.com:7050",
        "--ordererTLSHostnameOverride", "orderer.example.com",
        "--tls",
        "--cafile", "/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem",
        "-C", "mychannel",
        "-n", "basic",
        "--peerAddresses", "peer0.org1.example.com:7051",
        "--tlsRootCertFiles", "/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt",
        "--peerAddresses", "peer0.org2.example.com:9051",
        "--tlsRootCertFiles", "/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt",
        "-c", args_json
    ]
    
    success, output = _run_cli_command(cmd)
    if not success:
        # Detectar el error de Asset ya existente = Doble gasto/voto
        if "already exists" in output.lower():
            return False, "Error: Voto ya registrado con este Identificador (Doble Voto detectado)."
        return False, f"Error en la transacción a Fabric: {output}"
    
    return True, output

def get_all_votes():
    """
    Consulta todos los Activos al chaincode 'basic' y retorna el array de diccionarios.
    """
    args_json = json.dumps({
        "function": "GetAllAssets",
        "Args": []
    })
    
    # El comando query es más ligero y se ejecuta contra un nodo local en el CLI
    cmd = [
        "docker", "exec", "cli",
        "peer", "chaincode", "query",
        "-C", "mychannel",
        "-n", "basic",
        "-c", args_json
    ]
    
    success, output = _run_cli_command(cmd)
    if not success:
        return False, f"Fallo al consultar la red: {output}"
        
    try:
        # El subproceso puede capturar logs basura del logger del CLI.
        # Buscamos el inicio y el fin del array de objetos JSON que retorna el chaincode.
        start_idx = output.find("[")
        end_idx = output.rfind("]")
        if start_idx != -1 and end_idx != -1:
            json_data = output[start_idx:end_idx+1]
            data = json.loads(json_data)
            return True, data
        elif output.strip() == "":
            return True, []
        else:
            return False, f"Formato JSON inesperado desde Fabric: {output}"
    except json.JSONDecodeError:
        return False, "Error parseando los datos devueltos por la blockchain."
