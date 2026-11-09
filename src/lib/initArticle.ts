// @ts-nocheck
import articleDataRaw from "@/data/articleData.json";

export function initArticleCharts() {
  if (typeof window === "undefined") return;

  const D = articleDataRaw;
  const NS = "http://www.w3.org/2000/svg";
  const CL = ["OK", "RISCO", "FALHA"];
  const MODELOS = [
    { k: "arvore", nome: "Árvore de Decisão (Tarefa 4)", cor: "var(--m-arvore)" },
    { k: "random_forest", nome: "Random Forest (entregue)", cor: "var(--m-rf)" },
  ];
  const REF = { k: "persistencia", nome: "Persistência (referência)", cor: "var(--m-base)" };

  /* ---------- utilidades ---------- */
  function num(v, casas) {
    return Number(v).toLocaleString("pt-BR", {
      minimumFractionDigits: casas || 0,
      maximumFractionDigits: casas || 0,
    });
  }
  function pct(v, casas) {
    return num(v * 100, casas == null ? 1 : casas) + "%";
  }
  function s(tag, at, pai) {
    var e = document.createElementNS(NS, tag);
    for (var a in at) e.setAttribute(a, at[a]);
    if (pai) pai.appendChild(e);
    return e;
  }
  function h(tag, at, html) {
    var e = document.createElement(tag);
    for (var a in at) e.setAttribute(a, at[a]);
    if (html != null) e.innerHTML = html;
    return e;
  }
  function texto(pai, x, y, t, at) {
    at = at || {};
    at.x = x;
    at.y = y;
    var e = s("text", at, pai);
    e.textContent = t;
    return e;
  }
  function barraV(pai, x, y0, w, alt, at) {
    var r = Math.min(4, w / 2, alt);
    var y = y0 - alt;
    var d =
      "M" +
      x +
      "," +
      y0 +
      "V" +
      (y + r) +
      "Q" +
      x +
      "," +
      y +
      " " +
      (x + r) +
      "," +
      y +
      "H" +
      (x + w - r) +
      "Q" +
      (x + w) +
      "," +
      y +
      " " +
      (x + w) +
      "," +
      (y + r) +
      "V" +
      y0 +
      "Z";
    at = at || {};
    at.d = d;
    return s("path", at, pai);
  }
  function barraH(pai, x0, y, comp, alt, at) {
    var r = Math.min(4, alt / 2, comp);
    var x = x0 + comp;
    var d =
      "M" +
      x0 +
      "," +
      y +
      "H" +
      (x - r) +
      "Q" +
      x +
      "," +
      y +
      " " +
      x +
      "," +
      (y + r) +
      "V" +
      (y + alt - r) +
      "Q" +
      x +
      "," +
      (y + alt) +
      " " +
      (x - r) +
      "," +
      (y + alt) +
      "H" +
      x0 +
      "Z";
    at = at || {};
    at.d = d;
    return s("path", at, pai);
  }
  function tooltip(box) {
    var t = h("div", { class: "tip", role: "status" });
    t.hidden = true;
    box.appendChild(t);
    return {
      show: function (html, ev) {
        var r = box.getBoundingClientRect();
        t.innerHTML = html;
        t.hidden = false;
        var x = Math.max(70, Math.min(r.width - 70, ev.clientX - r.left));
        t.style.left = x + "px";
        t.style.top = ev.clientY - r.top + "px";
      },
      hide: function () {
        t.hidden = true;
      },
    };
  }
  function ligar(el, tip, html) {
    el.style.cursor = "default";
    el.addEventListener("mousemove", function (ev) {
      tip.show(html, ev);
    });
    el.addEventListener("mouseleave", tip.hide);
    el.addEventListener(
      "touchstart",
      function (ev) {
        tip.show(html, ev.touches[0]);
      },
      { passive: true }
    );
  }
  function tabelaDados(fig, cab, linhas) {
    if (!fig) return;
    if (fig.querySelector("details.dados")) return; // evita duplicatas se renderizar novamente
    var det = h("details", { class: "dados" });
    det.appendChild(h("summary", {}, "Ver os dados deste gráfico"));
    var w = h("div", { class: "tabela-wrap" });
    var t =
      "<table><thead><tr>" +
      cab
        .map(function (c, i) {
          return "<th" + (i ? ' class="n"' : "") + ">" + c + "</th>";
        })
        .join("") +
      "</tr></thead><tbody>";
    t += linhas
      .map(function (l) {
        return (
          "<tr>" +
          l
            .map(function (c, i) {
              return "<td" + (i ? ' class="n"' : "") + ">" + c + "</td>";
            })
            .join("") +
          "</tr>"
        );
      })
      .join("");
    w.innerHTML = t + "</tbody></table>";
    det.appendChild(w);
    var cap = fig.querySelector("figcaption");
    fig.insertBefore(det, cap);
  }
  function legenda(itens, ref) {
    var ul = h("ul", { class: "legend" });
    itens.forEach(function (m) {
      ul.appendChild(h("li", {}, '<i style="background:' + m.cor + '"></i>' + m.nome));
    });
    if (ref)
      ul.appendChild(
        h(
          "li",
          {},
          '<i style="border:1.5px dashed ' + ref.cor + ';background:transparent"></i>' + ref.nome
        )
      );
    return ul;
  }
  var desenhos = [];
  function registrar(fn) {
    desenhos.push(fn);
    fn();
  }
  var ultimaLargura = window.innerWidth,
    tm;
  const onResize = function () {
    clearTimeout(tm);
    tm = setTimeout(function () {
      if (Math.abs(window.innerWidth - ultimaLargura) < 8) return;
      ultimaLargura = window.innerWidth;
      desenhos.forEach(function (f) {
        f();
      });
    }, 120);
  };
  window.addEventListener("resize", onResize);

  /* ---------- Fig: mediana de RTT por fluxo ---------- */
  function figMedianas() {
    var box = document.getElementById("chart-medianas");
    if (!box) return;
    var dados = D.medianas;
    registrar(function () {
      box.innerHTML = "";
      var W = Math.max(300, box.clientWidth),
        H = W < 520 ? 230 : 280;
      var m = { t: 22, r: 10, b: 30, l: 40 };
      var iw = W - m.l - m.r,
        ih = H - m.t - m.b;
      var max = 400,
        ticks = [0, 100, 200, 300, 400];
      var svg = s(
        "svg",
        {
          viewBox: "0 0 " + W + " " + H,
          role: "img",
          "aria-label": "Mediana de RTT de cada um dos 157 fluxos, do menor para o maior",
        },
        box
      );
      var g = s("g", { transform: "translate(" + m.l + "," + m.t + ")" }, svg);
      var grid = s("g", { class: "grid" }, g);
      ticks.forEach(function (t) {
        var y = ih - (t / max) * ih;
        s("line", { x1: 0, x2: iw, y1: y, y2: y }, grid);
        texto(g, -8, y + 4, num(t), { "text-anchor": "end" });
      });
      texto(g, -8, -10, "ms", { "text-anchor": "end" });
      var bw = iw / dados.length,
        gap = bw > 4 ? 1 : 0.4;
      var tip = tooltip(box);
      dados.forEach(function (d, i) {
        var alt = Math.max(1.5, (d.v / max) * ih);
        var b = barraV(g, i * bw + gap / 2, ih, Math.max(0.8, bw - gap), alt, {
          fill: "var(--accent)",
        });
        ligar(
          b,
          tip,
          "<b>" +
            num(d.v, 1) +
            " ms</b><br>Rota " +
            d.r +
            "<br><span class='mono'>" +
            d.f +
            "</span>"
        );
      });
      var p = dados[0],
        u = dados[dados.length - 1];
      texto(g, 2, ih - 8, num(p.v, 2) + " ms (" + p.r + ")", { class: "lbl-strong" });
      texto(g, iw, ih - (u.v / max) * ih - 6, num(u.v, 1) + " ms (" + u.r + ")", {
        class: "lbl-strong",
        "text-anchor": "end",
      });
      s("line", { x1: 0, x2: iw, y1: ih, y2: ih, stroke: "var(--line)" }, g);
      texto(g, iw / 2, ih + 20, "157 fluxos, do menor para o maior RTT típico", {
        "text-anchor": "middle",
      });
    });
    tabelaDados(
      box.closest("figure"),
      ["Rota", "Fluxos", "Mediana típica (ms)"],
      D.rotas.map(function (r) {
        return [r.rota_id, r.fluxos, num(r.mediana, 1)];
      })
    );
  }

  /* ---------- Fig: distribuição do rótulo por bloco ---------- */
  function figBlocos() {
    var box = document.getElementById("chart-blocos");
    if (!box) return;
    var cores = { OK: "var(--ok)", RISCO: "var(--risco)", FALHA: "var(--falha)" };
    var nomes = { treino: "Treino", validacao: "Validação", teste: "Teste" };
    var blocos = ["treino", "validacao", "teste"];
    if (!box.parentNode.querySelector(".legend")) {
      box.parentNode.insertBefore(
        legenda(
          CL.map(function (c) {
            return { nome: c, cor: cores[c] };
          })
        ),
        box
      );
    }
    registrar(function () {
      box.innerHTML = "";
      var W = Math.max(300, box.clientWidth),
        estreito = W < 520;
      var m = { t: 4, r: 8, b: 4, l: estreito ? 76 : 96 },
        linha = 44,
        alt = 26;
      var H = m.t + m.b + linha * blocos.length;
      var iw = W - m.l - m.r;
      var svg = s(
        "svg",
        {
          viewBox: "0 0 " + W + " " + H,
          role: "img",
          "aria-label": "Proporção de OK, RISCO e FALHA no treino, na validação e no teste",
        },
        box
      );
      var tip = tooltip(box);
      blocos.forEach(function (b, i) {
        var c = D.dist_bloco[b],
          tot = c.OK + c.RISCO + c.FALHA,
          x = m.l,
          y = m.t + i * linha + (linha - alt) / 2;
        texto(svg, m.l - 10, y + alt / 2 - 2, nomes[b], {
          "text-anchor": "end",
          class: "lbl-strong",
        });
        texto(svg, m.l - 10, y + alt / 2 + 12, num(tot), { "text-anchor": "end" });
        CL.forEach(function (cl, j) {
          var w = (c[cl] / tot) * iw;
          var r = s(
            "rect",
            {
              x: x,
              y: y,
              width: Math.max(0, w - 2),
              height: alt,
              rx: j === 2 ? 4 : 0,
              fill: cores[cl],
            },
            svg
          );
          if (j === 2)
            s("rect", { x: x, y: y, width: Math.min(4, w - 2), height: alt, fill: cores[cl] }, svg);
          ligar(
            r,
            tip,
            "<b>" +
              nomes[b] +
              " · " +
              cl +
              "</b><br>" +
              num(c[cl]) +
              " linhas (" +
              pct(c[cl] / tot) +
              ")"
          );
          if (w > 48)
            texto(svg, x + 8, y + alt / 2 + 4, pct(c[cl] / tot, 1), {
              fill: "#fff",
              "font-weight": 650,
            });
          x += w;
        });
      });
    });
    tabelaDados(
      box.closest("figure"),
      ["Bloco", "OK", "RISCO", "FALHA", "Total"],
      blocos.map(function (b) {
        var c = D.dist_bloco[b];
        return [nomes[b], num(c.OK), num(c.RISCO), num(c.FALHA), num(c.OK + c.RISCO + c.FALHA)];
      })
    );
  }

  /* ---------- barras agrupadas verticais (métricas por modelo) ---------- */
  function fmtv(c, v) {
    return c.dec ? num(v, 3) : pct(v, 1);
  }
  function agrupadas(box, cats, series, ref, eixoDec, aria) {
    if (!box.parentNode.querySelector(".legend")) {
      box.parentNode.insertBefore(legenda(series, ref), box);
    }
    registrar(function () {
      box.innerHTML = "";
      var W = Math.max(300, box.clientWidth),
        estreito = W < 520;
      var H = estreito ? 250 : 290,
        m = { t: 20, r: 6, b: 46, l: 38 };
      var iw = W - m.l - m.r,
        ih = H - m.t - m.b;
      var svg = s("svg", { viewBox: "0 0 " + W + " " + H, role: "img", "aria-label": aria }, box);
      var g = s("g", { transform: "translate(" + m.l + "," + m.t + ")" }, svg);
      var grid = s("g", { class: "grid" }, g);
      [0, 0.25, 0.5, 0.75, 1].forEach(function (t) {
        var y = ih - t * ih;
        s("line", { x1: 0, x2: iw, y1: y, y2: y }, grid);
        texto(g, -8, y + 4, eixoDec ? num(t, t % 1 ? 2 : 0) : num(t * 100) + "%", {
          "text-anchor": "end",
        });
      });
      var n = series.length + (ref ? 1 : 0),
        cw = iw / cats.length,
        pad = cw * (estreito ? 0.12 : 0.18);
      var bw = (cw - 2 * pad) / n;
      var tip = tooltip(box);
      cats.forEach(function (c, i) {
        var x0 = i * cw + pad;
        series.forEach(function (sr, j) {
          var v = sr.vals[i],
            alt = Math.max(1.5, v * ih);
          var b = barraV(g, x0 + j * bw + 1, ih, bw - 2, alt, { fill: sr.cor });
          ligar(b, tip, "<b>" + sr.nome + "</b><br>" + c.nome.replace("|", " ") + ": " + fmtv(c, v));
          if (c.rotular && bw > 26)
            texto(g, x0 + j * bw + bw / 2, ih - alt - 5, fmtv(c, v), {
              "text-anchor": "middle",
              class: "lbl-strong",
              "font-size": estreito ? 9.5 : 10.5,
            });
        });
        if (ref) {
          var v = ref.vals[i],
            alt = Math.max(1.5, v * ih),
            x = x0 + series.length * bw + 1;
          s(
            "rect",
            {
              x: x + 0.75,
              y: ih - alt + 0.75,
              width: Math.max(0, bw - 3.5),
              height: Math.max(0, alt - 0.75),
              fill: "none",
              stroke: ref.cor,
              "stroke-width": 1.5,
              "stroke-dasharray": "4 3",
              rx: 3,
            },
            g
          );
          var alvo = s("rect", { x: x, y: ih - alt, width: bw - 2, height: alt, fill: "transparent" }, g);
          ligar(alvo, tip, "<b>" + ref.nome + "</b><br>" + c.nome.replace("|", " ") + ": " + fmtv(c, v));
        }
        var lin = c.nome.split("|");
        lin.forEach(function (t, k) {
          texto(g, i * cw + cw / 2, ih + 18 + k * 13, t, {
            "text-anchor": "middle",
            class: k ? "" : "lbl-strong",
          });
        });
      });
      s("line", { x1: 0, x2: iw, y1: ih, y2: ih, stroke: "var(--line)" }, g);
    });
    var cab = ["Modelo"].concat(
      cats.map(function (c) {
        return c.nome.replace("|", " ");
      })
    );
    var linhas = series.concat(ref ? [ref] : []).map(function (sr) {
      return [sr.nome].concat(
        sr.vals.map(function (v, i) {
          return cats[i].dec ? num(v, 4) : pct(v, 2);
        })
      );
    });
    tabelaDados(box.closest("figure"), cab, linhas);
  }

  function figMetricas() {
    var box = document.getElementById("chart-metricas");
    if (!box) return;
    var cats = [
      { nome: "F1 macro|nota geral", k: "f1", rotular: true, dec: true },
      { nome: "Recall|OK", k: "OK" },
      { nome: "Recall|RISCO", k: "RISCO" },
      { nome: "Recall|FALHA", k: "FALHA", rotular: true },
    ];
    function vals(mk) {
      var t = D.modelos[mk].teste;
      return cats.map(function (c) {
        return c.k === "f1" ? t.f1_macro : t.recall[c.k];
      });
    }
    agrupadas(
      box,
      cats,
      MODELOS.map(function (m) {
        return { nome: m.nome, cor: m.cor, vals: vals(m.k) };
      }),
      { nome: REF.nome, cor: REF.cor, vals: vals("persistencia") },
      true,
      "F1 macro e recall por classe no teste para os três modelos e a referência de persistência"
    );
  }

  function figTransicao() {
    var box = document.getElementById("chart-transicao");
    if (!box) return;
    var a = D.analise.acerto;
    var cats = [
      {
        nome: "Estado se mantém|" + pct(1 - D.analise.pct_mudanca, 0) + " do teste",
        k: "estavel",
        rotular: true,
      },
      {
        nome: "Estado muda em 12 min|" + pct(D.analise.pct_mudanca, 0) + " do teste",
        k: "mudanca",
        rotular: true,
      },
    ];
    agrupadas(
      box,
      cats,
      MODELOS.map(function (m) {
        return {
          nome: m.nome,
          cor: m.cor,
          vals: cats.map(function (c) {
            return a[m.k][c.k];
          }),
        };
      }),
      {
        nome: REF.nome,
        cor: REF.cor,
        vals: cats.map(function (c) {
          return a.persistencia[c.k];
        }),
      },
      false,
      "Taxa de acerto quando o estado da rede se mantém e quando muda nos próximos 12 minutos"
    );
  }

  /* ---------- importância por permutação ---------- */
  function figImportancia() {
    var box = document.getElementById("chart-importancia");
    if (!box) return;
    var P = D.importancia,
      feats = Object.keys(P.random_forest.queda).sort(function (x, y) {
        return P.random_forest.queda[y] - P.random_forest.queda[x];
      });
    if (!box.parentNode.querySelector(".legend")) {
      box.parentNode.insertBefore(legenda(MODELOS), box);
    }
    registrar(function () {
      box.innerHTML = "";
      var W = Math.max(300, box.clientWidth),
        estreito = W < 520;
      var m = { t: 6, r: 44, b: 26, l: estreito ? 108 : 128 },
        grupo = estreito ? 30 : 32,
        bh = (grupo - 8) / MODELOS.length;
      var maiorV = Math.max.apply(
        null,
        MODELOS.map(function (md) {
          return Math.max.apply(
            null,
            feats.map(function (f) {
              return P[md.k].queda[f];
            })
          );
        })
      );
      var max = Math.ceil(maiorV / 0.05) * 0.05,
        passos = [];
      for (var t0 = 0; t0 <= max + 1e-9; t0 += 0.05) passos.push(Math.round(t0 * 100) / 100);
      var H = m.t + m.b + grupo * feats.length,
        iw = W - m.l - m.r;
      var svg = s(
        "svg",
        {
          viewBox: "0 0 " + W + " " + H,
          role: "img",
          "aria-label": "Queda do F1 macro ao embaralhar cada atributo, por modelo",
        },
        box
      );
      var g = s("g", { transform: "translate(" + m.l + "," + m.t + ")" }, svg),
        ih = grupo * feats.length;
      var grid = s("g", { class: "grid" }, g);
      passos.forEach(function (t) {
        var x = (t / max) * iw;
        s("line", { x1: x, x2: x, y1: 0, y2: ih }, grid);
        if (!estreito || (t * 100) % 10 === 0)
          texto(g, x, ih + 16, num(t, 2), { "text-anchor": "middle" });
      });
      var tip = tooltip(box);
      feats.forEach(function (f, i) {
        var y0 = i * grupo + 4;
        texto(g, -10, y0 + grupo / 2, f, {
          "text-anchor": "end",
          class: "mono lbl-strong",
          "font-family": "var(--mono)",
          "font-size": estreito ? 10.5 : 11.5,
        });
        MODELOS.forEach(function (md, j) {
          var v = Math.max(0, P[md.k].queda[f]),
            w = Math.max(1.5, (v / max) * iw);
          var b = barraH(g, 0, y0 + j * bh, w, bh - 1.5, { fill: md.cor });
          ligar(
            b,
            tip,
            "<b>" + md.nome + "</b><br><span class='mono'>" + f + "</span>: −" + num(v, 3) + " de F1 macro"
          );
          if (i < 2 && v > 0.02) texto(g, w + 5, y0 + j * bh + bh / 2 + 2, num(v, 3), { "font-size": 9.5 });
        });
      });
      s("line", { x1: 0, x2: 0, y1: 0, y2: ih, stroke: "var(--line)" }, g);
    });
    tabelaDados(
      box.closest("figure"),
      ["Atributo"].concat(
        MODELOS.map(function (m) {
          return m.nome;
        })
      ),
      feats.map(function (f) {
        return [f].concat(
          MODELOS.map(function (m) {
            return num(P[m.k].queda[f], 4);
          })
        );
      })
    );
  }

  /* ---------- matrizes de confusão ---------- */
  function figMatrizes() {
    var box = document.getElementById("matrizes");
    if (!box) return;
    box.innerHTML = "";
    MODELOS.concat([{ k: "persistencia", nome: "Persistência (referência)", cor: "var(--m-base)" }]).forEach(
      function (md) {
        var M = D.modelos[md.k].matriz_teste;
        var d = h("div", { class: "matriz" });
        var t =
          "<h4><i style='background:" +
          md.cor +
          "'></i>" +
          md.nome +
          "</h4><table><thead><tr><th></th>" +
          CL.map(function (c) {
            return "<th>prev. " + c + "</th>";
          }).join("") +
          "</tr></thead><tbody>";
        M.forEach(function (lin, i) {
          var tot = lin.reduce(function (a, b) {
            return a + b;
          }, 0);
          t +=
            "<tr><th>real " +
            CL[i] +
            "</th>" +
            lin
              .map(function (v, j) {
                var p = v / tot,
                  cheio = p > 0.45;
                var fundo =
                  "color-mix(in srgb, var(--accent) " + Math.round(8 + p * 82) + "%, var(--surface))";
                var cor = cheio ? "#fff" : "var(--ink)";
                var marca = i === j ? "acerto" : "erro";
                return (
                  "<td title='" +
                  marca +
                  ": " +
                  num(v) +
                  " de " +
                  num(tot) +
                  "' style='background:" +
                  fundo +
                  ";color:" +
                  cor +
                  "'><b>" +
                  pct(p, 0) +
                  "</b><span>" +
                  num(v) +
                  "</span></td>"
                );
              })
              .join("") +
            "</tr>";
        });
        d.innerHTML =
          t + "</tbody></table><div class='matriz-eixo'>% de cada linha real · contagem embaixo</div>";
        box.appendChild(d);
      }
    );
  }

  /* ---------- abas da API e botões de copiar ---------- */
  function abas() {
    document.querySelectorAll("[data-abas]").forEach(function (grupo) {
      var bts = grupo.querySelectorAll("[role=tab]");
      bts.forEach(function (b) {
        b.addEventListener("click", function () {
          bts.forEach(function (o) {
            o.setAttribute("aria-selected", o === b ? "true" : "false");
            var el = document.getElementById(o.getAttribute("aria-controls"));
            if (el) el.hidden = o !== b;
          });
        });
      });
    });
    document.querySelectorAll(".copiar").forEach(function (b) {
      b.addEventListener("click", function () {
        var alvo = document.getElementById(b.getAttribute("data-alvo"));
        if (!alvo) return;
        var txt = alvo.innerText;
        function ok() {
          b.textContent = "Copiado";
          setTimeout(function () {
            b.textContent = "Copiar";
          }, 1600);
        }
        function sel() {
          var r = document.createRange();
          r.selectNodeContents(alvo);
          var se = window.getSelection();
          se.removeAllRanges();
          se.addRange(r);
          b.textContent = "Selecionado: Ctrl+C";
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(txt).then(ok, sel);
        } else {
          sel();
        }
      });
    });
  }

  abas();
  figMedianas();
  figBlocos();
  figMetricas();
  figTransicao();
  figImportancia();
  figMatrizes();

  return () => {
    window.removeEventListener("resize", onResize);
  };
}
