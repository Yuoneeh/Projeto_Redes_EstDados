# imports necessários
import os # criar pastas
import csv # salvar dados formatados
import time # manipular tempo dos pings
from datetime import datetime # manipular data dos pings
import requests # fazer comunicação com API


def coletar_dados(measurement_id=1001, limite=150): # puxa por padrao 1001, no maximo 150 linhas
    agora = int(time.time()) # momento atual em Unix Timestamp
    inicio = agora - 300  # ultimos 5 min
    url = f"https://atlas.ripe.net/api/v2/measurements/{measurement_id}/results/?start={inicio}&stop={agora}&format=json" # link da api + id da medicao e minuto de inicio e fim

    print("Buscando dados no RIPE Atlas...")
    res = requests.get(url, timeout=30) # baixa os dados com limite de espera de 30s
    res.raise_for_status() # se der erro para, para nao quebrar dps
    dados = res.json() # transforma os dados em json

    linhas = [] # linha vazia para o CSV
    classes = {"OK": 0, "RISCO": 0, "FALHA": 0} # dicionario para contar exemplos de cada tipo
    teto_classe = limite // 3 # pega as 150 linhas e divide em 3 (50, 50, 50) (chamado de undersampling) 

    for item in dados:
        ts = datetime.fromtimestamp(item.get("timestamp", agora)).strftime("%Y-%m-%d %H:%M:%S") # converte data e hora do ping Unix p ex: 2023-09-08 14:30:00
        ip = item.get("dst_addr") or item.get("from", "0.0.0.0") # pega o IP de destino, se nao achar pega o de origem ou set 0.0.0.0

        sent = item.get("sent", 3) # qnts enviados
        rcvd = item.get("rcvd", 0) # qnts voltaram
        perda = round(((sent - rcvd) / sent) * 100.0, 2) if sent else 100.0 # matematica para descobrir porcentagem de perda 
        latencia = round(item.get("avg", 0.0), 2) # media de quanto demorou o pacote, arredondado pra decimal

        # diferenca entre pings consecutivos
        # list comprehension. Vasculha o JSON e pega a lista com tempo exato da "batida" do ping
        rtts = [p["rtt"] for p in item.get("result", []) if isinstance(p, dict) and "rtt" in p] 
        # calc de Jitter (Variacao de atraso). Pega a dif entre um packet e o outro e tira a media
        jitter = round(sum(abs(rtts[i] - rtts[i - 1]) for i in range(1, len(rtts))) / len(rtts), 2) if len(rtts) > 1 else 0.0

        # regras pra criar o status real da rede
        if perda >= 20.0 or rcvd == 0:
            status = "FALHA"
        elif latencia > 80.0 or perda > 0.0 or jitter > 15.0:
            status = "RISCO"
        else:
            status = "OK"

        # so adiciona a linha CSV se atingir os 50
        if classes[status] < teto_classe:
            linhas.append([ts, ip, latencia, perda, jitter, status])
            classes[status] += 1

        # se bater as 150 linhas para
        if len(linhas) >= limite:
            break

    # cria e salva os dados
    os.makedirs("data", exist_ok=True)
    caminho = os.path.join("data", "log_rede.csv")

    with open(caminho, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["timestamp", "ip", "latencia_ms", "perda_pacotes_pct", "jitter_ms", "status_real"])
        writer.writerows(linhas)

    # relatorio do que quantos de cada classe foi capturado
    print(f"Salvo {len(linhas)} registros em {caminho}")
    print("Distribuicao:", classes)

# garante que o script so rode se executar direto no terminal
if __name__ == "__main__":
    coletar_dados()
