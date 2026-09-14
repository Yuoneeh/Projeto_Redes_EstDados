import os
import csv
import time
from datetime import datetime
import requests

def coletar_dados(measurement_id=1001, limite=150):
    agora = int(time.time())
    inicio = agora - 300  # ultimos 5 min
    url = f"https://atlas.ripe.net/api/v2/measurements/{measurement_id}/results/?start={inicio}&stop={agora}&format=json"

    print("Buscando dados no RIPE Atlas...")
    res = requests.get(url, timeout=30)
    res.raise_for_status()
    dados = res.json()

    linhas = []
    classes = {"OK": 0, "RISCO": 0, "FALHA": 0}
    teto_classe = limite // 3

    for item in dados:
        ts = datetime.fromtimestamp(item.get("timestamp", agora)).strftime("%Y-%m-%d %H:%M:%S")
        ip = item.get("dst_addr") or item.get("from", "0.0.0.0")

        sent = item.get("sent", 3)
        rcvd = item.get("rcvd", 0)
        perda = round(((sent - rcvd) / sent) * 100.0, 2) if sent else 100.0
        latencia = round(item.get("avg", 0.0), 2)

        # diferenca entre pings consecutivos
        rtts = [p["rtt"] for p in item.get("result", []) if isinstance(p, dict) and "rtt" in p]
        jitter = round(sum(abs(rtts[i] - rtts[i - 1]) for i in range(1, len(rtts))) / len(rtts), 2) if len(rtts) > 1 else 0.0

        if perda >= 20.0 or rcvd == 0:
            status = "FALHA"
        elif latencia > 80.0 or perda > 0.0 or jitter > 15.0:
            status = "RISCO"
        else:
            status = "OK"

        if classes[status] < teto_classe:
            linhas.append([ts, ip, latencia, perda, jitter, status])
            classes[status] += 1

        if len(linhas) >= limite:
            break

    os.makedirs("data", exist_ok=True)
    caminho = os.path.join("data", "log_rede.csv")

    with open(caminho, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["timestamp", "ip", "latencia_ms", "perda_pacotes_pct", "jitter_ms", "status_real"])
        writer.writerows(linhas)

    print(f"Salvo {len(linhas)} registros em {caminho}")
    print("Distribuicao:", classes)

if __name__ == "__main__":
    coletar_dados()
