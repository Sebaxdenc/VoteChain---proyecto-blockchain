# VoteChain - Hyperledger Fabric

Sistema de Votación Descentralizado conectado a una red Hyperledger Fabric existente, usando Python (FastAPI) y Vanilla JS.

Esta aplicación funciona como una interfaz web y un API Gateway que se comunica con una red de blockchain Hyperledger Fabric local usándolo como Ledger inmutable de votos. Implementa una simulación de prueba de conocimiento cero (**Zero-Knowledge Proof**) para anonimizar a los electores.

---

## 1. Prerrequisitos: Levantar Hyperledger Fabric

Antes de levantar el sistema web, necesitas tener corriendo la red de Hyperledger Fabric (la red blockchain subyacente).
Se asume que tienes instalado [Fabric Samples](https://hyperledger-fabric.readthedocs.io/en/latest/install.html).

### 1.1 Iniciar la Test-Network y el Chaincode
Abre una terminal (WSL/Linux o Git Bash) y dirígete al directorio de `fabric-samples/test-network`:

```bash
cd ~/fabric-samples/test-network

# Apagamos cualquier red anterior y limpiamos contenedores
./network.sh down

# Levantamos la red creando el canal por defecto "mychannel" y con las Autoridades Certificadoras (-ca)
./network.sh up createChannel -c mychannel -ca

# Instalamos y desplegamos el smart-contract (chaincode) básico que administra activos
./network.sh deployCC -ccn basic -ccp ../asset-transfer-basic/chaincode-go -ccl go
```

### 1.2 Iniciar el Contenedor CLI (Esencial)
Nuestro backend necesita enviar las transacciones a la red utilizando la herramienta CLI de Fabric de la Org1. En la misma máquina donde corres la red, levanta el contenedor `cli` con este comando:

```bash
docker run -d --name cli \
  --network fabric_test \
  -e GOPATH=/opt/gopath \
  -e CORE_VM_ENDPOINT=unix:///host/var/run/docker.sock \
  -e FABRIC_LOGGING_SPEC=INFO \
  -e CORE_PEER_ID=cli \
  -e CORE_PEER_ADDRESS=peer0.org1.example.com:7051 \
  -e CORE_PEER_LOCALMSPID=Org1MSP \
  -e CORE_PEER_TLS_ENABLED=true \
  -e CORE_PEER_TLS_CERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/server.crt \
  -e CORE_PEER_TLS_KEY_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/server.key \
  -e CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt \
  -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp \
  -v /var/run/:/host/var/run/ \
  -v ${PWD}/organizations:/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations \
  -v ${PWD}/scripts:/opt/gopath/src/github.com/hyperledger/fabric/peer/scripts/ \
  hyperledger/fabric-tools:latest \
  /bin/bash -c "while true; do sleep 30; done"
```

---

## 2. Iniciar VoteChain (Aplicación Web)

Una vez que la red blockchain y el `cli` están corriendo, es hora de encender el backend de Python y el Frontend.

Ve al directorio de este proyecto (`VoteChain---proyecto-blockchain`) y ejecuta:

```bash
docker-compose up -d --build
```
> Esto instalará FastAPI y montará Nginx para el frontend. Estarán enrutados automáticamente a la red `fabric_test`.

---

## 3. Uso del App

### Interfaces Disponibles
- **Panel de Estudiantes y Dashboard:** [http://localhost:8080](http://localhost:8080)
- **Documentación Backend (Swagger):** [http://localhost:8000/docs](http://localhost:8000/docs)

### Flujo de Votación y Seguridad
1. Ingresa a la interfaz web en el puerto `8080`.
2. Escribe tu **ID o código de estudiante** (ej. `123456`).
3. Internamente *(Zero-Knowledge Proof)*, el frontend en JavaScript creará un Hash **SHA-256** de tu ID agregando una llave hash, el cual actuará como la clave única del voto (Asset ID) en el Ledger de Hyperledger Fabric. Tu identidad real nunca viaja por la red ni se guarda.
4. Selecciona un candidato para votar.
5. El servidor Python ejecutará los subprocesos CLI enviándole las propuestas a *(Org1 y Org2)* hasta que retornar "Consenso Alcanzado".
6. La gráfica `Chart.js` se actualizará inmediatamente mostrando los resultados en vivo.

### Prevención de Doble Voto
Gracias a la naturaleza de Hyperledger Fabric, cada "Voto" se inserta como un Asset en la cadena. Como la clave primaria del Asset es tu ID Hasheado de estudiante, si intentas usar o ingresar este mismo ID en la plataforma nuevamente para votar, la red Fabric denegará la creación del bloque. El frontend captará este rechazo e indicará un error de "Doble voto detectado".

