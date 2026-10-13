'use client';
// Menu de opções: botão direito, dedo segurado e os botões "⋯".
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { GRUPOS_DO_COMODO, JEITOS_PORTA, JEITO_NOME, NOME_PAREDE, ORDEM_PAREDE, ORDEM_TIPOS, TIPOS, TIPOS_PAREDE, ehParede, tipoDoComodo } from '@/lib/catalogo';
import { andaresOrdem, comodosDoAndar, comodosOrdem, ladosDaPorta, vizinhosDeParede } from '@/lib/consultas';
import { jeitoDaPorta, temGiro } from '@/lib/geometria';
import type { JeitoPorta } from '@/lib/tipos';
import { paraArquivo } from '@/lib/dados';
import { imagemDaPlanta } from '@/lib/exportar';
import {
  abrirDialogo, alternar, alternarCamada, alternarParede, atualizar, avisarLigacoes, colar, copiar, duplicar, duplicarComodo, editarItem, fecharMenu, focarComodo, girar, iniciarAdd, levar,
  mostrarTudo, mudarIdioma, mudarJeitoPorta, mudarModo, mudarTema, mudarVista, pedirRemover, girarComodo, sairCenario, selecionarComodo, temCopia, toast, travar, useApp, usarCenario, virarAbertura, virarDobradica, type Camada, type InfoMenu
} from '@/lib/store';
import { tx } from '@/lib/i18n';
import { clamp } from '@/lib/util';
import { REPOSITORIO } from './Dialogo';

/** marcado: item de escolha única (idioma, tema); check: liga e desliga (camadas); fica: o menu continua aberto. */
interface Item { a: string; t: string; perigo?: boolean; marcado?: boolean; check?: boolean; fica?: boolean }
type Bloco = { titulo?: string; grade?: boolean; itens: Item[] };

const CAMADAS_MENU = (): [Camada, string][] => [
  ['moveis', tx('Móveis', 'Furniture')], ['portas', tx('Portas e janelas', 'Doors and windows')], ['ar', tx('Ar-condicionado', 'Air conditioners')],
  ['pontos', tx('Tomadas, interruptores e outros pontos', 'Outlets, switches and hookups')], ['nomes', tx('Nomes de portas, janelas e pontos', 'Names of doors, windows and hookups')], ['grade', tx('Grade de 50 cm', '50 cm grid')]
];



function exportar() {
  const corpo = paraArquivo(useApp.getState().dados);
  const nome = 'cabeai-' + new Date().toISOString().slice(0, 10) + '.json';
  const blob = new Blob([corpo], { type: 'application/json' }), url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = nome;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  toast(tx('Arquivo salvo. Guarde-o para levar sua casa para outro aparelho.', 'File saved. Keep it to move your home to another device.'));
}

function blocos(m: InfoMenu): Bloco[] {
  const s = useApp.getState(), d = s.dados;
  const varios = comodosOrdem(d).length > 1;
  if (m.tipo === 'item') {
    if (m.id && d.moveis[m.id]) {
      const mv = d.moveis[m.id];
      return [{ titulo: mv.nome, itens: [{ a: 'editar', t: tx('Editar…', 'Edit…') }, { a: 'girar', t: tx('Girar 90°', 'Rotate 90°') }, { a: 'duplicar', t: tx('Duplicar', 'Duplicate') }, { a: 'copiar', t: tx('Copiar (para colar em outro lugar)', 'Copy (to paste somewhere else)') }, ...(varios ? [{ a: 'levar', t: tx('Levar para outro cômodo…', 'Move to another room…') }] : []), { a: 'travar', t: mv.fixo ? tx('Destravar', 'Unlock') : tx('Travar no lugar', 'Lock in place') }] },
        { itens: [{ a: 'remover', t: tx('Remover…', 'Remove…'), perigo: true }] }];
    }
    if (m.eid && d.els[m.eid]) {
      const e = d.els[m.eid], its: Item[] = [{ a: 'editar', t: tx('Editar…', 'Edit…') }], extra: Bloco[] = [];
      if (e.tipo === 'porta' && !e.semParede) {
        // a porta é da parede: para que lado abre, pelo nome do cômodo, e o jeito dela
        const j = jeitoDaPorta(e), l = ladosDaPorta(d, e), outro = e.abre === 'fora' ? l.dentro : l.fora;
        if (temGiro(e)) its.push({ a: 'abre', t: tx(`Abrir para ${outro}`, `Open into ${outro}`) });
        if (j === 'abrir' || j === 'correr') its.push({ a: 'dob', t: j === 'correr' ? tx('Correr para o outro lado', 'Slide the other way') : tx('Virar a dobradiça', 'Flip the hinge') });
        extra.push({ titulo: tx('Tipo de porta', 'Door type'), grade: true, itens: JEITOS_PORTA.map((k) => ({ a: 'jeito:' + k, t: JEITO_NOME[k], marcado: j === k })) });
      }
      if (e.tipo === 'janela') its.push({ a: 'jan', t: e.abertura === 'abrir' ? tx('Mudar para de correr', 'Change to sliding') : tx('Mudar para de abrir', 'Change to hinged') });
      its.push({ a: 'duplicar', t: tx('Duplicar', 'Duplicate') }, { a: 'copiar', t: tx('Copiar (para colar em outro lugar)', 'Copy (to paste somewhere else)') });
      return [{ titulo: e.nome, itens: its }, ...extra, { itens: [{ a: 'remover', t: tx('Remover…', 'Remove…'), perigo: true }] }];
    }
    return [];
  }
  if (m.tipo === 'ponto' && m.comodo && d.comodos[m.comodo]) {
    const q = d.comodos[m.comodo], grupos = GRUPOS_DO_COMODO[tipoDoComodo(q)];
    // os móveis que combinam com o cômodo (no banheiro, os do banheiro); o resto fica em "Outro móvel…"
    const tipos = grupos.length ? ORDEM_TIPOS.filter((k) => grupos.includes(TIPOS[k].grupo)) : ORDEM_TIPOS;
    return [
      ...(temCopia() ? [{ itens: [{ a: 'colar', t: tx('Colar aqui', 'Paste here') }] }] : []),
      { titulo: tx(`Adicionar aqui · ${q.nome}`, `Add here · ${q.nome}`), grade: true, itens: [...tipos.map((k) => ({ a: 'add:' + k, t: TIPOS[k].chip })), ...(grupos.length ? [{ a: 'add:movel', t: tx('Outro móvel…', 'Other furniture…') }] : [])] },
      { titulo: tx(`Na parede ${NOME_PAREDE[m.parede || 'cima']}`, `On the ${NOME_PAREDE[m.parede || 'cima']} wall`), grade: true, itens: ORDEM_PAREDE.map((k) => ({ a: 'add:' + k, t: TIPOS_PAREDE[k].rot })) },
      { itens: [{ a: 'q-editar', t: tx('Editar este cômodo…', 'Edit this room…') }, ...(s.vista !== 'um' ? [{ a: 'q-ver', t: tx('Ver só este cômodo', 'View only this room') }] : [])] }
    ];
  }
  if (m.tipo === 'comodo' && m.comodo && d.comodos[m.comodo]) {
    const q = d.comodos[m.comodo], as = andaresOrdem(d), paredes = blocoParedes(q.id);
    return [{ titulo: q.nome, itens: [{ a: 'q-editar', t: tx('Editar nome e medidas…', 'Edit name and measurements…') }, { a: 'q-ver', t: tx('Ver só este cômodo', 'View only this room') }, { a: 'q-add', t: tx('Adicionar um item…', 'Add an item…') },
      ...(s.vista === 'casa' ? [{ a: 'q-sel', t: tx('Mover na planta da casa', 'Move on the home plan') }] : []),
      ...(comodosOrdem(d).length > 1 ? [{ a: 'q-lado', t: tx('Colocar ao lado de outro cômodo…', 'Place next to another room…') }] : []),
      { a: 'q-girar', t: tx('Girar 90°', 'Rotate 90°') },
      { a: 'q-duplicar', t: tx('Duplicar o cômodo (com o que tem dentro)', 'Duplicate the room (with what’s inside)') },
      { a: 'q-corredor', t: tx('Ligar por um corredor…', 'Connect with a hallway…') },
      ...(as.length > 1 ? [{ a: 'q-andar', t: tx('Mudar de andar…', 'Move to another floor…') }] : [])] },
    ...(paredes ? [paredes] : []),
    { itens: [{ a: 'q-remover', t: tx('Remover cômodo…', 'Remove room…'), perigo: true }] }];
  }
  if (m.tipo === 'paredes' && m.comodo && d.comodos[m.comodo]) {
    const b = blocoParedes(m.comodo);
    return b ? [b] : [{ titulo: d.comodos[m.comodo].nome, itens: [{ a: 'nada', t: tx('Este cômodo não divide parede com outro.', 'This room doesn’t share a wall with another one.') }] }];
  }
  if (m.tipo === 'camadas') {
    return [
      { titulo: tx('Mostrar na planta', 'Show on the plan'), itens: CAMADAS_MENU().map(([k, t]) => ({ a: 'cam:' + k, t, check: s.camadas[k], fica: true })) },
      { itens: [{ a: 'setas', t: tx('Medidas em todos os móveis', 'Measurements on all furniture'), check: s.setasTodos, fica: true }, { a: 'ima', t: tx('Ímã (gruda nas paredes)', 'Snap (sticks to walls)'), check: s.imaOn, fica: true }] },
      ...(Object.values(s.camadas).some((v) => !v) ? [{ itens: [{ a: 'cam-tudo', t: tx('Mostrar tudo', 'Show everything') }] }] : [])
    ];
  }
  if (m.tipo === 'andar' && m.andar && d.andares[m.andar]) {
    const a = d.andares[m.andar], n = comodosDoAndar(d, a.id).length;
    return [{ titulo: a.nome, itens: [{ a: 'a-comodo', t: tx('Novo cômodo neste andar…', 'New room on this floor…') }, { a: 'a-nome', t: tx('Renomear andar…', 'Rename floor…') }] },
      { itens: [{ a: 'a-remover', t: n ? tx('Remover andar e cômodos…', 'Remove floor and rooms…') : tx('Remover andar…', 'Remove floor…'), perigo: true }] }];
  }
  if (m.tipo === 'cenario' && m.cen && d.cenarios[m.cen]) {
    const c = d.cenarios[m.cen];
    return [{ titulo: c.nome, itens: [{ a: 'cen-renomear', t: tx('Renomear…', 'Rename…') }, { a: 'cen-sobrescrever', t: tx('Salvar o atual por cima…', 'Overwrite with the current layout…') }] }, { itens: [{ a: 'cen-remover', t: tx('Apagar cenário…', 'Delete scenario…'), perigo: true }] }];
  }
  if (m.tipo === 'cen-planta' && m.cen && d.cenarios[m.cen]) {
    return [{ titulo: d.cenarios[m.cen].nome, itens: [{ a: 'cen-usar', t: tx('Usar este cenário', 'Use this scenario') }, { a: 'cen-sair', t: tx('Voltar para o atual', 'Back to current') }] }];
  }
  if (m.tipo === 'mais') {
    const out: Bloco[] = [];
    if (s.estreito) {
      out.push({ titulo: tx('Vista e modo', 'View and mode'), itens: [
        { a: 'vista-um', t: tx('Ver um cômodo', 'View one room'), marcado: s.vista === 'um' }, { a: 'vista-lado', t: tx('Cômodos lado a lado', 'Rooms side by side'), marcado: s.vista === 'lado' }, { a: 'vista-casa', t: tx('Planta da casa', 'Home plan'), marcado: s.vista === 'casa' },
        { a: 'modo-simples', t: tx('Modo simples', 'Simple mode'), marcado: s.modo === 'simples' }, { a: 'modo-avancado', t: tx('Modo avançado', 'Advanced mode'), marcado: s.modo === 'avancado' }
      ] });
    }
    const temCasa = Object.keys(d.comodos).length > 0;
    out.push({ titulo: tx('Casa', 'Home'), itens: [
      { a: 'historico', t: tx('Histórico e pontos de restauração', 'History and restore points') },
      ...(temCasa ? [{ a: 'resumo', t: tx('Resumo e lista de móveis', 'Summary and furniture list') }, { a: 'imagem', t: tx('Salvar a planta como imagem', 'Save the plan as an image') }] : [])
    ] });
    out.push({ titulo: tx('Arquivo', 'File'), itens: [{ a: 'exportar', t: tx('Exportar (salvar arquivo)', 'Export (save a file)') }, { a: 'importar', t: tx('Importar arquivo…', 'Import a file…') }] });
    out.push({ titulo: tx('Tema', 'Theme'), grade: true, itens: [{ a: 'tema-auto', t: tx('Automático', 'Automatic'), marcado: s.tema === 'auto' }, { a: 'tema-claro', t: tx('Claro', 'Light'), marcado: s.tema === 'claro' }, { a: 'tema-escuro', t: tx('Escuro', 'Dark'), marcado: s.tema === 'escuro' }] });
    out.push({ titulo: tx('Idioma', 'Language'), grade: true, itens: [{ a: 'idioma-pt', t: 'Português', marcado: s.idioma === 'pt' }, { a: 'idioma-en', t: 'English', marcado: s.idioma === 'en' }] });
    out.push({ itens: [{ a: 'apoiar', t: tx('♥ Apoiar o Cabeaí', '♥ Support Cabeaí') }, { a: 'ajuda', t: tx('Como usar e atalhos', 'How to use and shortcuts') }, { a: 'codigo', t: tx('Código aberto no GitHub', 'Open source on GitHub') }, { a: 'zerar', t: tx('Apagar tudo…', 'Delete everything…'), perigo: true }] });
    return out;
  }
  return [];
}

/** As paredes que o cômodo divide com os vizinhos: tirar (vira um espaço só) ou pôr de volta. */
function blocoParedes(id: string): Bloco | null {
  const d = useApp.getState().dados, vs = vizinhosDeParede(d, id);
  if (!vs.length) return null;
  return {
    titulo: tx('Paredes com os vizinhos', 'Walls shared with neighbors'),
    itens: vs.map((v) => ({ a: 'parede:' + v.viz.id, t: v.tirada ? tx(`Pôr de volta a parede com ${v.viz.nome}`, `Put back the wall with ${v.viz.nome}`) : tx(`Tirar a parede com ${v.viz.nome} (vira um espaço só)`, `Remove the wall with ${v.viz.nome} (one space)`) }))
  };
}

function executar(a: string, m: InfoMenu) {
  const s = useApp.getState(), d = s.dados;
  // ligar e desligar camadas deixa o menu aberto (dá para mexer em várias de uma vez)
  if (a.startsWith('cam:')) { alternarCamada(a.slice(4) as Camada); return; }
  if (a === 'setas') { atualizar((x) => { x.setasTodos = !x.setasTodos; }); return; }
  if (a === 'ima') { atualizar((x) => { x.imaOn = !x.imaOn; }); return; }
  fecharMenu();
  if (a.startsWith('jeito:')) { if (s.selEl) mudarJeitoPorta(s.selEl, a.slice(6) as JeitoPorta); return; }
  if (a.startsWith('parede:')) { const q = m.comodo || s.selComodo || s.comodo; if (q) alternarParede(q, a.slice(7)); return; }
  if (a === 'add:movel') { const q = (m.comodo && d.comodos[m.comodo]) || (s.comodo && d.comodos[s.comodo]); if (q) iniciarAdd('movel', m.px != null && m.py != null ? { comodo: q.id, x: Math.round(clamp(m.px, 0, q.w)), y: Math.round(clamp(m.py, 0, q.h)) } : { comodo: q.id }); return; }
  if (a.startsWith('add:')) {
    const tipo = a.slice(4), q = (m.comodo && d.comodos[m.comodo]) || (s.comodo && d.comodos[s.comodo]); if (!q) return;
    iniciarAdd(tipo, ehParede(tipo) ? { comodo: q.id, parede: m.parede, u: m.u } : m.px != null && m.py != null ? { comodo: q.id, x: Math.round(clamp(m.px, 0, q.w)), y: Math.round(clamp(m.py, 0, q.h)) } : { comodo: q.id });
    return;
  }
  const qid = m.comodo || s.comodo || '', cen = m.cen || s.verCen || '';
  switch (a) {
    case 'editar': editarItem(); break;
    case 'girar': girar(); break;
    case 'duplicar': duplicar(); break;
    case 'levar': levar(); break;
    case 'travar': travar(); break;
    case 'remover': pedirRemover(); break;
    case 'dob': if (s.selEl) virarDobradica(s.selEl); break;
    case 'abre': if (s.selEl) virarAbertura(s.selEl); break;
    case 'jan': alternar('jan'); break;
    case 'q-editar': abrirDialogo('comodo', { id: qid }); break;
    case 'q-ver': focarComodo(qid, true); break;
    case 'q-add': focarComodo(qid, false); iniciarAdd('movel', { comodo: qid }); break;
    case 'q-sel': selecionarComodo(qid); toast(tx('Arraste o cômodo pelo piso ou pelo nome para mudar o lugar dele; as alças azuis esticam as paredes. Setas do teclado também movem.', 'Drag the room by its floor or name to move it; the blue handles stretch the walls. The arrow keys move it too.')); break;
    case 'q-andar': abrirDialogo('andar-comodo', { id: qid }); break;
    case 'q-lado': abrirDialogo('comodo', { id: qid, onde: 'direita' }); break;
    case 'q-corredor': abrirDialogo('corredor', { a: qid }); break;
    case 'q-girar': avisarLigacoes(qid, girarComodo(qid)); break;
    case 'q-duplicar': { const nid = duplicarComodo(qid); const n = nid ? useApp.getState().dados.comodos[nid] : null; if (n) toast(tx(`${n.nome} criado ao lado, com tudo o que tinha dentro.`, `${n.nome} created next to it, with everything inside.`), '', 'desfazer'); break; }
    case 'copiar': copiar(); break;
    case 'colar': colar(m.comodo ? { comodo: m.comodo, x: m.px != null ? Math.round(m.px) : undefined, y: m.py != null ? Math.round(m.py) : undefined } : null); break;
    case 'cam-tudo': mostrarTudo(); break;
    case 'historico': abrirDialogo('historico'); break;
    case 'resumo': abrirDialogo('resumo'); break;
    case 'imagem': void imagemDaPlanta(); break;
    case 'tema-auto': mudarTema('auto'); break;
    case 'tema-claro': mudarTema('claro'); break;
    case 'tema-escuro': mudarTema('escuro'); break;
    case 'q-remover': abrirDialogo('remover-comodo', { id: qid }); break;
    case 'a-comodo': abrirDialogo('comodo', { andar: m.andar }); break;
    case 'a-nome': abrirDialogo('andar-nome', { id: m.andar }); break;
    case 'a-remover': abrirDialogo('remover-andar', { id: m.andar }); break;
    case 'cen-usar': if (d.cenarios[cen]) { usarCenario(cen); toast(tx(`“${d.cenarios[cen].nome}” está valendo agora.`, `“${d.cenarios[cen].nome}” is now in use.`)); } break;
    case 'cen-sair': sairCenario(); break;
    case 'cen-renomear': abrirDialogo('cen-nome', { id: cen }); break;
    case 'cen-sobrescrever': abrirDialogo('cen-sobrescrever', { id: cen }); break;
    case 'cen-remover': abrirDialogo('cen-remover', { id: cen }); break;
    case 'vista-um': mudarVista('um'); break;
    case 'vista-lado': mudarVista('lado'); break;
    case 'vista-casa': mudarVista('casa'); break;
    case 'modo-simples': mudarModo('simples'); break;
    case 'modo-avancado': mudarModo('avancado'); break;
    case 'exportar': exportar(); break;
    case 'importar': document.getElementById('arquivo')?.click(); break;
    case 'ajuda': abrirDialogo('ajuda'); break;
    case 'apoiar': abrirDialogo('apoiar'); break;
    case 'idioma-pt': mudarIdioma('pt'); break;
    case 'idioma-en': mudarIdioma('en'); break;
    case 'codigo': window.open(REPOSITORIO, '_blank', 'noopener,noreferrer'); break;
    case 'zerar': abrirDialogo('zerar'); break;
    default: break;
  }
}

export default function Menu() {
  const menu = useApp((s) => s.menu);
  // o menu de camadas fica aberto enquanto liga e desliga: redesenha quando elas mudam
  useApp((s) => s.camadas); useApp((s) => s.setasTodos); useApp((s) => s.imaOn);
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const abriu = useRef(0);
  useLayoutEffect(() => {
    if (!menu || !ref.current) return;
    abriu.current = Date.now();
    const r = ref.current.getBoundingClientRect(), vw = document.documentElement.clientWidth || window.innerWidth, vh = window.innerHeight;
    let x = menu.x + 4, y = menu.y + 4;
    if (x + r.width > vw - 8) x = Math.max(8, menu.x - r.width - 4);
    if (y + r.height > vh - 8) y = Math.max(8, vh - 8 - r.height);
    setPos({ x: Math.round(x), y: Math.round(y) });
    if (menu.teclado) (ref.current.querySelector('button') as HTMLElement | null)?.focus({ preventScroll: true });
  }, [menu]);
  useEffect(() => {
    if (!menu) return;
    const fora = (e: PointerEvent) => {
      const t = e.target as Element;
      if (ref.current?.contains(t)) return;
      if (menu.btn && document.getElementById(menu.btn)?.contains(t)) return; // o próprio botão abre e fecha
      fecharMenu();
    };
    document.addEventListener('pointerdown', fora, true);
    const fechar = () => fecharMenu();
    window.addEventListener('resize', fechar);
    return () => { document.removeEventListener('pointerdown', fora, true); window.removeEventListener('resize', fechar); };
  }, [menu]);
  if (!menu) return null;
  const bs = blocos(menu);
  if (!bs.length) return null;
  const teclas = (e: React.KeyboardEvent) => {
    const btns = Array.from(ref.current?.querySelectorAll('button') || []) as HTMLElement[], i = btns.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); const n = btns.length; if (!n) return; btns[i < 0 ? 0 : (i + (e.key === 'ArrowDown' ? 1 : n - 1)) % n].focus(); }
    else if (e.key === 'Tab' || e.key === 'Escape') fecharMenu();
  };
  return (
    <div className="menu" id="menu" role="menu" aria-label={tx('Opções', 'Options')} ref={ref} style={{ left: pos.x, top: pos.y }} onKeyDown={teclas}>
      {bs.map((b, k) => (
        <div key={k} className="menu-bloco">
          {k > 0 && <hr />}
          {b.titulo && <div className="menu-t">{b.titulo}</div>}
          <div className={b.grade ? 'menu-grade' : 'menu-lista'}>
            {b.itens.map((it) => (
              <button key={it.a} type="button" role={it.check != null ? 'menuitemcheckbox' : it.marcado != null ? 'menuitemradio' : 'menuitem'} aria-checked={it.check != null ? it.check : it.marcado != null ? it.marcado : undefined} data-m={it.a}
                className={[it.perigo ? 'perigo' : '', it.check != null ? 'caixa' : ''].filter(Boolean).join(' ') || undefined} disabled={it.a === 'nada'}
                onClick={() => { if (!it.fica && Date.now() - abriu.current < 350) return; executar(it.a, menu); }}>{it.t}</button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
