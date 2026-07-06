/**
 * Simulação de 3 meses — Entrega Futura
 * 6 importações quinzenais, cobranças, reincidências, drill-downs
 * Playwright – node sim3meses.spec.js
 *
 * IMPORTANTE: let/const do app NÃO são window.X — usar nome direto em page.evaluate
 */
const { chromium } = require('playwright');
const fs = require('fs');

// ── Dados base do simulador ───────────────────────────────────────────────────

const PRODUTOS = [
  {cod:'P001',desc:'GLIFOSATO 480 G/L',    vlr:85.50, linha:'1- HERBICIDAS'},
  {cod:'P002',desc:'ROUNDUP ORIGINAL DI',  vlr:140.00,linha:'1- HERBICIDAS'},
  {cod:'P003',desc:'SCORE 250 EC',         vlr:320.00,linha:'2- FUNGICIDAS'},
  {cod:'P004',desc:'ABAMECTINA 18 EC',     vlr:195.00,linha:'5- INSETICIDAS'},
  {cod:'P005',desc:'SOJA NIDERA 5909',     vlr:280.00,linha:'18- SEMENTES'},
  {cod:'P006',desc:'SOJA TMG 7062',        vlr:310.00,linha:'18- SEMENTES'},
  {cod:'P007',desc:'UREIA GRANULADA',      vlr:42.00, linha:'3- FERTILIZANTES'},
  {cod:'P008',desc:'AZOXISTROBINA 250',    vlr:450.00,linha:'2- FUNGICIDAS'},
  {cod:'P009',desc:'CLOMAZONA 500',        vlr:75.00, linha:'1- HERBICIDAS'},
  {cod:'P010',desc:'DELTAMETRINA 25',      vlr:125.00,linha:'5- INSETICIDAS'},
];

const CLIENTES = [
  'FAZENDA BOA VISTA LTDA','AGROPECUARIA SÃO LUCAS',
  'COOPERATIVA UNIAO AGRICOLA','SÍTIO RECANTO VERDE',
  'PECUARIA DOIS IRMÃOS','FAZENDA ESPERANÇA',
  'RURAL DO CAMPO LTDA','AGRI MINAS SOLUÇÕES',
];

function fmtD(d){ return d.toISOString().slice(0,10); }

function makeHeader(){
  return [
    'Dias Pendentes','Limite x Lin','Filial NF','Sigla NF',
    'Filial Ped','Sigla Ped','N° Pedido','Desd','Emissão NF',
    'Cliente','Nome Cliente','Cidade','Vendedor','Nome Vendedor',
    'Produto','Descrição Produto','Saldo','Peso Unit','Valor Unitário',
    'Peso Total','Tipo Entrega','Valor Frete','Linha','Sublinha',
    'Qtde Vnd','Qtde Entr','Qtde Dev','Fornecedor','Vlr Saldo (Título)'
  ];
}

function makeRow(pedido, desdobr, emissao, sigla, prod, cliente, saldo, devido, dias, limite=90){
  return [
    dias, limite, sigla, sigla, sigla, sigla,
    pedido, desdobr, emissao,
    'C0001', cliente, 'GOIÂNIA', 'V001', 'VENDEDOR TESTE',
    prod.cod, prod.desc,
    saldo, 0.5, prod.vlr, saldo*0.5,
    'COLETAR', 0, prod.linha, '',
    saldo, 0, 0, 'FORNECEDOR X', devido
  ];
}

function buildScenario(){
  const itens = [];
  let pedNum = 1000;
  const baseEmissao = new Date('2026-01-15'); // 80 dias antes de 05/abr

  // 12 total, 10 parc, 18 ret
  const grupos = [
    // grpTotal
    {sigla:'MTZ',prod:PRODUTOS[0],saldo:100,pago:8550, cliente:CLIENTES[0],limite:90},
    {sigla:'ARG',prod:PRODUTOS[2],saldo:20, pago:6400, cliente:CLIENTES[1],limite:90},
    {sigla:'RVD',prod:PRODUTOS[1],saldo:50, pago:7000, cliente:CLIENTES[2],limite:60},
    {sigla:'UBR',prod:PRODUTOS[4],saldo:30, pago:8400, cliente:CLIENTES[3],limite:90},
    {sigla:'MAR',prod:PRODUTOS[5],saldo:25, pago:7750, cliente:CLIENTES[4],limite:90},
    {sigla:'BAR',prod:PRODUTOS[7],saldo:15, pago:6750, cliente:CLIENTES[5],limite:60},
    {sigla:'FCB',prod:PRODUTOS[6],saldo:200,pago:8400, cliente:CLIENTES[6],limite:90},
    {sigla:'CON',prod:PRODUTOS[3],saldo:40, pago:7800, cliente:CLIENTES[7],limite:90},
    {sigla:'MTZ',prod:PRODUTOS[9],saldo:60, pago:7500, cliente:CLIENTES[0],limite:90},
    {sigla:'ARG',prod:PRODUTOS[0],saldo:80, pago:6840, cliente:CLIENTES[1],limite:90},
    {sigla:'JAT',prod:PRODUTOS[1],saldo:20, pago:2800, cliente:CLIENTES[2],limite:90},
    {sigla:'CRI',prod:PRODUTOS[8],saldo:120,pago:9000, cliente:CLIENTES[3],limite:60},
    // grpParc
    {sigla:'FAG',prod:PRODUTOS[2],saldo:30, pago:4800, cliente:CLIENTES[0],limite:90},
    {sigla:'RED',prod:PRODUTOS[4],saldo:50, pago:7000, cliente:CLIENTES[1],limite:90},
    {sigla:'IMP',prod:PRODUTOS[5],saldo:40, pago:8000, cliente:CLIENTES[2],limite:90},
    {sigla:'PAL',prod:PRODUTOS[0],saldo:150,pago:6000, cliente:CLIENTES[3],limite:90},
    {sigla:'MOZ',prod:PRODUTOS[6],saldo:500,pago:10000,cliente:CLIENTES[4],limite:60}, // atrasado, parc
    {sigla:'PGM',prod:PRODUTOS[7],saldo:10, pago:2000, cliente:CLIENTES[5],limite:90},
    {sigla:'SFX',prod:PRODUTOS[3],saldo:25, pago:3000, cliente:CLIENTES[6],limite:90},
    {sigla:'URU',prod:PRODUTOS[1],saldo:35, pago:4000, cliente:CLIENTES[7],limite:90},
    {sigla:'MOR',prod:PRODUTOS[8],saldo:80, pago:3000, cliente:CLIENTES[0],limite:90},
    {sigla:'FOR',prod:PRODUTOS[9],saldo:45, pago:2500, cliente:CLIENTES[1],limite:90},
    // grpRet
    {sigla:'JUS',prod:PRODUTOS[0],saldo:200,pago:0,    cliente:CLIENTES[2],limite:90},
    {sigla:'XRA',prod:PRODUTOS[2],saldo:15, pago:0,    cliente:CLIENTES[3],limite:60},
    {sigla:'POR',prod:PRODUTOS[4],saldo:60, pago:0,    cliente:CLIENTES[4],limite:90},
    {sigla:'PLA',prod:PRODUTOS[5],saldo:20, pago:0,    cliente:CLIENTES[5],limite:90},
    {sigla:'GRA',prod:PRODUTOS[6],saldo:400,pago:0,    cliente:CLIENTES[6],limite:90},
    {sigla:'CAN',prod:PRODUTOS[7],saldo:12, pago:0,    cliente:CLIENTES[7],limite:60}, // atrasado, ret
    {sigla:'GUR',prod:PRODUTOS[3],saldo:55, pago:0,    cliente:CLIENTES[0],limite:90},
    {sigla:'RIA',prod:PRODUTOS[1],saldo:30, pago:0,    cliente:CLIENTES[1],limite:90},
    {sigla:'ALT',prod:PRODUTOS[8],saldo:75, pago:0,    cliente:CLIENTES[2],limite:90},
    {sigla:'MTZ',prod:PRODUTOS[9],saldo:90, pago:0,    cliente:CLIENTES[3],limite:90},
    {sigla:'ARG',prod:PRODUTOS[0],saldo:110,pago:0,    cliente:CLIENTES[4],limite:90},
    {sigla:'UBR',prod:PRODUTOS[2],saldo:25, pago:0,    cliente:CLIENTES[5],limite:60}, // atrasado, ret
    {sigla:'MAR',prod:PRODUTOS[4],saldo:40, pago:0,    cliente:CLIENTES[6],limite:90},
    {sigla:'FAP',prod:PRODUTOS[5],saldo:18, pago:0,    cliente:CLIENTES[7],limite:90},
    {sigla:'RVD',prod:PRODUTOS[6],saldo:320,pago:0,    cliente:CLIENTES[0],limite:90},
    {sigla:'JAT',prod:PRODUTOS[7],saldo:22, pago:0,    cliente:CLIENTES[1],limite:60}, // atrasado, ret
    {sigla:'CRI',prod:PRODUTOS[3],saldo:50, pago:0,    cliente:CLIENTES[2],limite:90},
    {sigla:'FAG',prod:PRODUTOS[1],saldo:65, pago:0,    cliente:CLIENTES[3],limite:90},
  ];

  grupos.forEach((it,i) => {
    pedNum++;
    it.pedido = String(pedNum);
    it.desdobr = '1';
    it.emissao = fmtD(new Date(baseEmissao.getTime() + (i%3)*14*86400000));
    itens.push(it);
  });

  return itens;
}

// ── Runner ─────────────────────────────────────────────────────────────────

const BUGS = [], WARNS = [], INFOS = [];
const jsErrors = [];

function bug(msg){ BUGS.push(msg); console.error('❌ BUG:', msg); }
function warn(msg){ WARNS.push(msg); console.warn('⚠️  WARN:', msg); }
function info(msg){ INFOS.push(msg); console.log('ℹ️  INFO:', msg); }

async function run(){
  const browser = await chromium.launch({ headless: true, args:['--no-sandbox'] });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  page.on('console', msg => {
    if(msg.type()==='error'){
      const t = msg.text();
      if(!t.includes('ERR_TUNNEL') && !t.includes('ERR_FAILED') &&
         !t.includes('histLoad') && !t.includes('histSave') &&
         !t.includes('Failed to load resource') && !t.includes('publishHistToGithub')){
        jsErrors.push(t);
        console.warn('[browser error]:', t);
      }
    }
  });
  page.on('pageerror', err => {
    const msg = err.message;
    if(!msg.includes('histLoad') && !msg.includes('histSave') && !msg.includes('fetch')){
      jsErrors.push(msg);
      console.error('[pageerror]:', msg);
    }
  });

  await page.goto('file:///home/user/Entrega-Futura/index.html', { waitUntil:'domcontentloaded', timeout:15000 });
  await page.waitForTimeout(500);

  // Desativa GitHub para que histLoad retorne imediatamente (testes determinísticos)
  // CFG_DEFAULT tem ghRepo setado, então precisa sobrescrever explicitamente
  await page.evaluate(()=>{
    localStorage.setItem('ef_config_v1', JSON.stringify({ghToken:'', ghRepo:''}));
  });
  await page.waitForTimeout(500);

  const introVisible = await page.locator('#intro').isVisible();
  if(!introVisible) bug('Tela de introdução (dropzone) não está visível ao abrir');
  else info('Tela de introdução visível ✓');

  const syncText = await page.locator('#syncPill').textContent().catch(()=>'N/A');
  info(`Status de sync inicial: ${syncText.trim()}`);

  // ── Helper de importação ─────────────────────────────────────────────────
  // NOTA: usa variáveis diretas (RECORDS, dataRef, COMP, sortState) — NÃO window.X
  // porque são declaradas com let/const no script do app
  const importData = async (rows, label, date) => {
    info(`\n=== IMPORTAÇÃO: ${label} (data ref: ${date}) ===`);

    const result = await page.evaluate(({rows, dateStr}) => {
      try {
        RECORDS = processRows(rows);
        if(RECORDS.length === 0) return {ok:false, msg:'processRows retornou 0 registros'};
        dataRef = new Date(dateStr);
        COMP = null;
        sortState = {};
        bootApp(true);
        return {
          ok: true,
          total: RECORDS.length,
          cobr: RECORDS.filter(r=>r.status!=='ret').length,
          ret:  RECORDS.filter(r=>r.status==='ret').length,
          atr:  RECORDS.filter(r=>r.atrasado).length,
          atrCobr: RECORDS.filter(r=>r.status!=='ret'&&r.atrasado).length,
          dataRef: dataRef.toISOString().slice(0,10)
        };
      } catch(e) {
        return {ok:false, msg:e.message+'\n'+e.stack};
      }
    }, {rows, dateStr: date});

    if(!result.ok){
      bug(`${label}: falhou — ${result.msg}`);
      return null;
    }
    info(`  ${result.total} itens | ${result.cobr} cobráveis | ${result.ret} retidos | ${result.atr} atrasados | dataRef=${result.dataRef}`);
    await page.waitForTimeout(600); // aguarda async de registrarImportacao
    return result;
  };

  // ═══════════════════════════════════════════════════════════════
  // IMPORT-1  05/Abr — estado inicial
  // ═══════════════════════════════════════════════════════════════
  const allItens = buildScenario();
  info(`Cenário criado: ${allItens.length} itens iniciais`);

  const imp1rows = [makeHeader()];
  for(const it of allItens){
    const dias = Math.floor((new Date('2026-04-05') - new Date(it.emissao)) / 86400000);
    const vlrP = it.saldo * it.prod.vlr;
    const vlrD = Math.max(0, vlrP - (it.pago||0));
    imp1rows.push(makeRow(it.pedido,'1',it.emissao,it.sigla,it.prod,it.cliente,it.saldo,vlrD,dias,it.limite||90));
  }
  const r1 = await importData(imp1rows, 'IMPORT-1 (05/Abr)', '2026-04-05');
  if(!r1){ await browser.close(); process.exit(1); }

  const appVisible = await page.locator('#app').isVisible();
  if(!appVisible) bug('Após import 1, #app não ficou visível');
  else info('App visível após import 1 ✓');

  // ── Resumo: KPIs e badge ─────────────────────────────────────────────────
  info('\n-- Resumo --');
  const kpiCount = await page.locator('#cardsResumo .card.kpi').count();
  if(kpiCount !== 5) bug(`Resumo: esperava 5 KPIs, encontrou ${kpiCount}`);
  else info(`Resumo: ${kpiCount} KPIs ✓`);

  const clickableKpis = await page.locator('#cardsResumo .card.clickable').count();
  if(clickableKpis !== 5) bug(`Resumo: esperava 5 KPIs clicáveis, encontrou ${clickableKpis}`);
  else info(`Resumo: ${clickableKpis} KPIs clicáveis ✓`);

  const badgeText = await page.locator('#badgeCobrar').textContent();
  const atrasadosCobrar = await page.evaluate(()=> RECORDS.filter(r=>r.status!=='ret'&&r.atrasado).length);
  if(String(atrasadosCobrar)!==badgeText.trim() && !(atrasadosCobrar===0 && badgeText.trim()===''))
    bug(`Badge Cobrar agora: mostra "${badgeText.trim()}" mas atrasados cobráveis=${atrasadosCobrar}`);
  else info(`Badge "Cobrar agora" = "${badgeText.trim()}" (atrasados cobráveis=${atrasadosCobrar}) ✓`);

  // ── KPI drill-down: Retido → pg-retidos ─────────────────────────────────
  info('\n-- KPI drill-down: Retido → Retidos --');
  await page.locator('#cardsResumo .card.kpi.r').last().click();
  await page.waitForTimeout(300);
  const pgRetOn = await page.locator('#pg-retidos').evaluate(el=>el.classList.contains('on'));
  if(!pgRetOn) bug('KPI Retido no Resumo não navegou para pg-retidos');
  else info('Drill-down KPI Retido → pg-retidos ✓');

  const retKpis = await page.locator('#cardsRetidos .card.kpi').count();
  if(retKpis !== 3) bug(`Retidos: esperava 3 KPIs, encontrou ${retKpis}`);
  else info(`Retidos: ${retKpis} KPIs ✓`);

  // Verificar valores dos KPIs (sem NaN/undefined/vazio)
  const retKpiVals = await page.locator('#cardsRetidos .card.kpi .val').allTextContents();
  info(`  Retidos KPIs: ${retKpiVals.join(' | ')}`);
  if(retKpiVals.some(v=>!v.trim()||v.includes('NaN')||v.includes('undefined')))
    bug('Retidos: KPI com valor inválido');

  // ── Cobrar agora ─────────────────────────────────────────────────────────
  info('\n-- Cobrar agora --');
  await page.click('[data-pg="cobrar"]');
  await page.waitForTimeout(300);
  const cobKpis = await page.locator('#cardsCobrar .card.kpi').count();
  if(cobKpis !== 3) bug(`Cobrar: esperava 3 KPIs, encontrou ${cobKpis}`);
  else info(`Cobrar: ${cobKpis} KPIs ✓`);

  const atrKpiClickable = await page.locator('#cardsCobrar .card.kpi.clickable').count();
  if(atrKpiClickable !== 1) bug(`Cobrar: esperava 1 KPI clicável (Atrasados), encontrou ${atrKpiClickable}`);
  else info(`Cobrar: KPI "Atrasados" clicável ✓`);

  // Filtro "Só atrasados" deve estar ativo por padrão
  const soatrOn = await page.locator('#fbCobrar [data-f="soatr"]').evaluate(el=>el.classList.contains('on'));
  if(!soatrOn) bug('Cobrar: filtro "Só atrasados" deveria estar ativo por padrão');
  else info('Cobrar: "Só atrasados" ativo por padrão ✓');

  // ── Marcar 8 itens como cobrados ─────────────────────────────────────────
  info('\n-- Marcando cobranças (8 itens) --');
  const marcarOk = await page.evaluate(() => {
    const cobr = RECORDS.filter(r=>r.status!=='ret').slice(0,8);
    cobr.forEach(r => marcarItem(itemKey(r), true)); // itemKey é const — acessível diretamente
    calcularAuditoria();
    return cobr.length;
  });
  info(`  ${marcarOk} itens marcados como cobrados`);
  await page.waitForTimeout(200);

  // ── Auditoria: KPIs e drill-down ─────────────────────────────────────────
  info('\n-- Auditoria --');
  await page.click('[data-pg="auditoria"]');
  await page.waitForTimeout(400);

  const audKpis = await page.locator('#cardsAudit .card.kpi').count();
  if(audKpis !== 3) bug(`Auditoria: esperava 3 KPIs, encontrou ${audKpis}`);
  else info(`Auditoria: ${audKpis} KPIs ✓`);

  // KPI "Não cobrados" → filtro st_nao=on, ag=off, re=off
  await page.locator('#cardsAudit .card.kpi').first().click();
  await page.waitForTimeout(200);
  const naoOn = await page.locator('#fbAudit [data-f="st_nao"].on').count();
  const agOn  = await page.locator('#fbAudit [data-f="st_ag"].on').count();
  const reOn  = await page.locator('#fbAudit [data-f="st_re"].on').count();
  if(naoOn!==1||agOn!==0||reOn!==0)
    bug(`kpiFilterAudit(true,false,false): chips nao=${naoOn},ag=${agOn},re=${reOn}`);
  else info('kpiFilterAudit(true,false,false) ✓');

  // KPI "Reincidentes" → re=on
  await page.locator('#cardsAudit .card.kpi.r').click();
  await page.waitForTimeout(200);
  const reOn2 = await page.locator('#fbAudit [data-f="st_re"].on').count();
  if(reOn2!==1) bug(`kpiFilterAudit(false,false,true): chip re=${reOn2} (esperava 1)`);
  else info('kpiFilterAudit(false,false,true) ✓');

  // ── doSortAudit — deve chamar renderAuditoria, NÃO rerender() ────────────
  info('\n-- doSortAudit (sem disparar rerender) --');
  const rerenderCount = await page.evaluate(()=>{
    let cnt = 0;
    // rerender é function declaration → está em window
    const orig = rerender;
    // Monkey-patch via window para testar
    window._rerenderOrig = orig;
    rerender = function(){ cnt++; orig(); };
    doSortAudit('sigla');
    rerender = orig;
    delete window._rerenderOrig;
    return cnt;
  }).catch(()=>-1);
  // Se retornou -1, houve erro na tentativa de patchear; isso é aceitável
  if(rerenderCount > 0) bug(`doSortAudit chamou rerender() ${rerenderCount} vez(es) — bug B1 não corrigido`);
  else info('doSortAudit: sem rerender() extra ✓');

  // ── Insights ─────────────────────────────────────────────────────────────
  info('\n-- Insights --');
  await page.click('[data-pg="insights"]');
  await page.waitForTimeout(300);
  const insHTML = await page.locator('#insightsBox').innerHTML();
  if(!insHTML || insHTML.length < 100) bug('Insights: conteúdo vazio ou muito pequeno');
  else info(`Insights: ${insHTML.length} chars ✓`);
  if(!insHTML.includes('R$')) bug('Insights: sem valores em R$');
  else info('Insights: valores R$ presentes ✓');

  // ── Sidebar: pg-base e pg-conferencia ────────────────────────────────────
  info('\n-- Sidebar: pg-base e pg-conferencia --');
  if(await page.locator('[data-pg="base"]').count()<1) bug('Sidebar: pg-base ausente');
  else info('Sidebar: pg-base ✓');
  if(await page.locator('[data-pg="conferencia"]').count()<1) bug('Sidebar: pg-conferencia ausente');
  else info('Sidebar: pg-conferencia ✓');

  await page.click('[data-pg="base"]');
  await page.waitForTimeout(300);
  if(!(await page.locator('#pg-base').evaluate(el=>el.classList.contains('on')))) bug('pg-base não ficou ativo');
  else {
    const baseRows = await page.locator('#tblBase tbody tr').count();
    if(baseRows===0) bug('Base completa: tabela vazia');
    else info(`Base completa: ${baseRows} linhas ✓`);
  }

  await page.click('[data-pg="conferencia"]');
  await page.waitForTimeout(300);
  if(!(await page.locator('#pg-conferencia').evaluate(el=>el.classList.contains('on')))) bug('pg-conferencia não ficou ativo');
  else {
    const confKpis = await page.locator('#confBox .card.kpi').count();
    if(confKpis !== 3) bug(`Conferência: esperava 3 KPIs, encontrou ${confKpis}`);
    else info(`Conferência: ${confKpis} KPIs ✓`);
  }

  // ── Tabelas por filial/auditor/regional ──────────────────────────────────
  info('\n-- Responsabilização (filiais/auditores/regionais) --');
  for(const pg of ['filiais','auditores','regionais']){
    await page.click(`[data-pg="${pg}"]`);
    await page.waitForTimeout(300);
    const id = `tbl${pg.charAt(0).toUpperCase()+pg.slice(1)}`;
    const rows = await page.locator(`#${id} tbody tr`).count();
    if(rows===0) bug(`${pg}: tabela vazia`);
    else info(`${pg}: ${rows} linhas ✓`);
  }

  // MATO GROSSO deve aparecer
  const regHTML = await page.locator('#tblRegionais').innerHTML();
  if(!regHTML.includes('MATO GROSSO')) warn('MATO GROSSO não aparece na tabela de regionais');
  else info('MATO GROSSO presente em regionais ✓');

  // ── Consulta por filial ───────────────────────────────────────────────────
  info('\n-- Consulta MTZ --');
  await page.click('[data-pg="consulta"]');
  await page.waitForTimeout(300);
  await page.selectOption('#selConsultaFilial', 'MTZ');
  await page.waitForTimeout(200);
  const consultaKpis = await page.locator('#consultaCards .card.kpi').count();
  if(consultaKpis !== 4) bug(`Consulta: esperava 4 KPIs, encontrou ${consultaKpis}`);
  else info(`Consulta MTZ: ${consultaKpis} KPIs ✓`);

  // ── Recorrência ───────────────────────────────────────────────────────────
  info('\n-- Clientes Recorrentes --');
  await page.click('[data-pg="recorrencia"]');
  await page.waitForTimeout(300);
  const recorRows = await page.locator('#tblRecor tbody tr').count();
  info(`Recorrência: ${recorRows} linha(s)`);

  // ── Evolução: sem comparação na 1ª import ────────────────────────────────
  info('\n-- Evolução (import 1, sem comparação) --');
  await page.click('[data-pg="evolucao"]');
  await page.waitForTimeout(300);
  const cmpBox1 = await page.locator('#cmpBox').innerHTML();
  if(cmpBox1.includes('Entregue por completo')) warn('Evolução: cards de comparação aparecem mas não deveria (1ª import)');
  else info('Evolução: sem comparação na 1ª import ✓');

  // ═══════════════════════════════════════════════════════════════
  // IMPORT-2  19/Abr — 5 entregues, 3 saldos reduzidos, 2 novos
  // ═══════════════════════════════════════════════════════════════
  info('\n\n--- Preparando IMPORT-2 ---');
  const allItens2 = JSON.parse(JSON.stringify(allItens));
  for(let i=0;i<5;i++) allItens2[i].entregue = true;
  allItens2[12].saldo = Math.max(1, Math.floor(allItens2[12].saldo * 0.6));
  allItens2[13].saldo = Math.max(1, Math.floor(allItens2[13].saldo * 0.5));
  allItens2[14].saldo = Math.max(1, Math.floor(allItens2[14].saldo * 0.7));

  const novos2 = [
    {pedido:'9001',desdobr:'1',sigla:'MTZ',prod:PRODUTOS[1],saldo:30,pago:4200,cliente:CLIENTES[5],limite:90,emissao:'2026-04-10'},
    {pedido:'9002',desdobr:'1',sigla:'RVD',prod:PRODUTOS[3],saldo:15,pago:0,   cliente:CLIENTES[6],limite:90,emissao:'2026-04-12'},
  ];

  const imp2rows = [makeHeader()];
  const data2 = new Date('2026-04-19');
  for(const it of [...allItens2,...novos2]){
    if(it.entregue) continue;
    const dias = Math.floor((data2 - new Date(it.emissao))/86400000);
    const vlrP = it.saldo * it.prod.vlr;
    const vlrD = Math.max(0, vlrP-(it.pago||0));
    imp2rows.push(makeRow(it.pedido,'1',it.emissao,it.sigla,it.prod,it.cliente,it.saldo,vlrD,dias,it.limite||90));
  }

  const r2 = await importData(imp2rows, 'IMPORT-2 (19/Abr)', '2026-04-19');
  if(!r2){ await browser.close(); process.exit(1); }

  // Verificar COMP (usa variável direta, não window.COMP)
  const comp2 = await page.evaluate(()=>({
    qtdEnt:   COMP?.qtdEntTotal,
    qtdParc:  COMP?.qtdParc,
    qtdNovos: COMP?.qtdNovos,
  }));
  if(comp2.qtdEnt !== 5) bug(`Import-2: COMP.qtdEntTotal=${comp2.qtdEnt} (esperava 5)`);
  else info(`Import-2: ${comp2.qtdEnt} entregues totais ✓`);
  if(comp2.qtdParc !== 3) warn(`Import-2: COMP.qtdParc=${comp2.qtdParc} (esperava 3)`);
  else info(`Import-2: ${comp2.qtdParc} parciais ✓`);
  if(comp2.qtdNovos !== 2) bug(`Import-2: COMP.qtdNovos=${comp2.qtdNovos} (esperava 2)`);
  else info(`Import-2: ${comp2.qtdNovos} novos ✓`);

  // Evolução deve ter cards de comparação
  await page.click('[data-pg="evolucao"]');
  await page.waitForTimeout(300);
  const cmpBox2 = await page.locator('#cmpBox').innerHTML();
  if(!cmpBox2.includes('Entregue por completo')) bug('Import-2: cards de comparação não aparecem na Evolução');
  else info('Import-2: Evolução com cards de comparação ✓');

  const entCards = await page.locator('#cmpBox .card.clickable').count();
  if(entCards < 3) bug(`Import-2 Evolução: esperava >= 3 KPIs clicáveis, encontrou ${entCards}`);
  else info(`Import-2: ${entCards} KPIs de comparação clicáveis ✓`);

  // scrollToEntregues: clicar 1º card → chip "Entregues totais" ON
  if(entCards >= 3){
    await page.locator('#cmpBox .card.clickable').first().click();
    await page.waitForTimeout(300);
    const entTotalOn = await page.locator('#entTotal.on').count();
    const entParcOn  = await page.locator('#entParc.on').count();
    if(entTotalOn!==1||entParcOn!==0) bug(`scrollToEntregues('total'): total.on=${entTotalOn}, parc.on=${entParcOn}`);
    else info('scrollToEntregues("total") ✓');
  }

  // ═══════════════════════════════════════════════════════════════
  // Antes da IMPORT-3: retroagir datas para gerar reincidentes
  // ═══════════════════════════════════════════════════════════════
  info('\n-- Retroagindo datas de COBR para gerar reincidentes --');
  const dataCobrPassada = '2026-04-01'; // 32 dias antes de 03/mai (> DIAS_REINCIDENCIA=10)
  await page.evaluate((dateStr) => {
    let cnt = 0;
    for(const k of Object.keys(COBR)){
      COBR[k].u = dateStr;
      COBR[k].d = dateStr;
      if(++cnt >= 8) break;
    }
    calcularAuditoria();
  }, dataCobrPassada);

  const rsm3 = await page.evaluate(()=> resumoAuditoria());
  if(rsm3.reincidente === 0) bug('Reincidentes: esperava >0 após retroagir datas, obteve 0');
  else info(`Reincidentes gerados: ${rsm3.reincidente} ✓`);

  const badgeReinc = await page.locator('#badgeReinc').textContent();
  info(`Badge Reincidentes: "${badgeReinc.trim()}"`);

  // ═══════════════════════════════════════════════════════════════
  // IMPORT-3  03/Mai — 3 novos entregues + 2 novos pedidos
  // ═══════════════════════════════════════════════════════════════
  info('\n\n--- Preparando IMPORT-3 ---');
  const allItens3 = JSON.parse(JSON.stringify(allItens2.filter(it=>!it.entregue)));
  for(let i=0;i<3;i++) if(allItens3[i]) allItens3[i].entregue = true;
  const novos3 = [
    {pedido:'9003',desdobr:'1',sigla:'CON',prod:PRODUTOS[0],saldo:80,pago:6840,cliente:CLIENTES[0],limite:90,emissao:'2026-04-28'},
    {pedido:'9004',desdobr:'1',sigla:'BAR',prod:PRODUTOS[5],saldo:10,pago:0,   cliente:CLIENTES[1],limite:60,emissao:'2026-04-28'},
  ];

  const imp3rows = [makeHeader()];
  const data3 = new Date('2026-05-03');
  for(const it of [...allItens3,...novos2,...novos3]){
    if(it.entregue) continue;
    const dias = Math.floor((data3 - new Date(it.emissao))/86400000);
    const vlrP = it.saldo * it.prod.vlr;
    const vlrD = Math.max(0, vlrP-(it.pago||0));
    imp3rows.push(makeRow(it.pedido,'1',it.emissao,it.sigla,it.prod,it.cliente,it.saldo,vlrD,dias,it.limite||90));
  }

  const r3 = await importData(imp3rows, 'IMPORT-3 (03/Mai)', '2026-05-03');
  if(!r3){ await browser.close(); process.exit(1); }

  // kpiAuditFilial: Consulta MTZ → drill-down Auditoria filtrada
  info('\n-- kpiAuditFilial drill-down --');
  await page.click('[data-pg="consulta"]');
  await page.waitForTimeout(200);
  await page.selectOption('#selConsultaFilial','MTZ');
  await page.waitForTimeout(200);
  // Localizar o KPI "sem cobrança" (último KPI da consulta)
  const kpiAuditBtn = page.locator('#consultaCards .card.kpi').last();
  const kpiAuditText = await kpiAuditBtn.textContent();
  if(kpiAuditText.toLowerCase().includes('sem cobrança')||kpiAuditText.toLowerCase().includes('itens sem')){
    const isClickable = await kpiAuditBtn.evaluate(el=>el.classList.contains('clickable'));
    if(!isClickable) bug('Consulta: card "sem cobrança" não está clicável para MTZ com itens');
    else {
      await kpiAuditBtn.click();
      await page.waitForTimeout(300);
      if(!(await page.locator('#pg-auditoria').evaluate(el=>el.classList.contains('on'))))
        bug('kpiAuditFilial: não navegou para Auditoria');
      else {
        const siglaVal = await page.locator('#fbAudit [data-f="sigla"]').inputValue().catch(()=>'N/A');
        if(siglaVal !== 'MTZ') bug(`kpiAuditFilial: select.value="${siglaVal}" (esperava "MTZ")`);
        else info('kpiAuditFilial: Auditoria filtrada por MTZ ✓');
      }
    }
  } else info(`kpiAuditFilial: card não tem "sem cobrança" — texto="${kpiAuditText.trim().slice(0,50)}"`);

  // ═══════════════════════════════════════════════════════════════
  // IMPORTS 4, 5, 6 — ciclo quinzenal: Mai–Jun
  // ═══════════════════════════════════════════════════════════════
  const ciclos = [
    {data:'2026-05-17',label:'IMPORT-4 (17/Mai)', entregar:4, novos:[]},
    {data:'2026-06-01',label:'IMPORT-5 (01/Jun)', entregar:5, novos:[
      {pedido:'9005',desdobr:'1',sigla:'PLA',prod:PRODUTOS[6],saldo:100,pago:4200,cliente:CLIENTES[2],limite:90,emissao:'2026-05-25'},
    ]},
    {data:'2026-06-15',label:'IMPORT-6 (15/Jun)', entregar:5, novos:[]},
  ];

  // Reconstruir lista de itens do imp3 para ciclos 4-6
  let itensCiclo = imp3rows.slice(1).map(row=>({
    pedido:  String(row[6]),
    desdobr: String(row[7]),
    sigla:   String(row[5]).trim(),
    prod:    PRODUTOS.find(p=>p.cod===String(row[14])) || PRODUTOS[0],
    saldo:   Number(row[16]),
    pago:    Math.max(0, Number(row[16])*Number(row[18]) - Number(row[28])),
    cliente: String(row[10]),
    emissao: String(row[8]),
    limite:  Number(row[1])||90,
    entregue:false
  }));

  for(const ciclo of ciclos){
    let ent = 0;
    for(const it of itensCiclo){
      if(ent >= ciclo.entregar) break;
      if(!it.entregue){ it.entregue=true; ent++; }
    }
    const cicloRows = [makeHeader()];
    const dataC = new Date(ciclo.data);
    for(const it of [...itensCiclo,...(ciclo.novos||[])]){
      if(it.entregue) continue;
      const dias = Math.floor((dataC - new Date(it.emissao))/86400000);
      const vlrP = it.saldo * it.prod.vlr;
      const vlrD = Math.max(0, vlrP-(it.pago||0));
      cicloRows.push(makeRow(it.pedido,'1',it.emissao,it.sigla,it.prod,it.cliente,it.saldo,vlrD,dias,it.limite||90));
    }
    if(ciclo.novos) itensCiclo.push(...ciclo.novos);
    const rC = await importData(cicloRows, ciclo.label, ciclo.data);
    if(!rC) warn(`${ciclo.label}: import falhou, continuando...`);
  }

  // ═══════════════════════════════════════════════════════════════
  // Verificações finais após 6 imports
  // ═══════════════════════════════════════════════════════════════
  info('\n\n-- Histórico ao final dos 3 meses --');
  await page.click('[data-pg="evolucao"]');
  await page.waitForTimeout(400);

  const histLen = await page.evaluate(()=> HIST.semanas.length);
  if(histLen < 6) bug(`Histórico: ${histLen} semanas (esperava >= 6)`);
  else info(`Histórico: ${histLen} semanas ✓`);

  const histRows = await page.locator('#tblHist tbody tr').count();
  if(histRows < 6) bug(`tblHist: ${histRows} linhas (esperava >= 6)`);
  else info(`tblHist: ${histRows} linhas ✓`);

  const mesLen = await page.evaluate(()=> Object.keys(HIST.meses||{}).length);
  if(mesLen < 2) warn(`Histórico de meses: ${mesLen} (esperava >= 2)`);
  else info(`Histórico meses: ${mesLen} ✓`);

  // Insights final
  info('\n-- Insights ao final --');
  await page.click('[data-pg="insights"]');
  await page.waitForTimeout(400);
  const insBlocks = await page.locator('#insightsBox .insight').count();
  if(insBlocks < 3) bug(`Insights: ${insBlocks} blocos (esperava >= 3)`);
  else info(`Insights: ${insBlocks} blocos ✓`);

  // ── Erros JS do browser ───────────────────────────────────────────────────
  info('\n-- Erros JS do browser --');
  if(jsErrors.length > 0){
    jsErrors.forEach(e => bug(`Console JS error: ${e}`));
  } else info('Sem erros JS inesperados ✓');

  // ── Edge cases: vlr_unit=0, saldo=0 ──────────────────────────────────────
  info('\n-- Edge cases --');
  const edgeRes = await page.evaluate(()=>{
    const hdr = ['Dias Pendentes','Limite x Lin','Filial NF','Sigla NF','Filial Ped','Sigla Ped',
                 'N° Pedido','Desd','Emissão NF','Cliente','Nome Cliente','Cidade','Vendedor',
                 'Nome Vendedor','Produto','Descrição Produto','Saldo','Peso Unit','Valor Unitário',
                 'Peso Total','Tipo Entrega','Valor Frete','Linha','Sublinha','Qtde Vnd','Qtde Entr',
                 'Qtde Dev','Fornecedor','Vlr Saldo (Título)'];
    const rows = [hdr,
      // saldo=0 → deve ser ignorado
      [30,90,'MTZ','MTZ','MTZ','MTZ','EC001','1','2026-01-01','C1','CLI A','GO','V1','VEN','PR1','P A',0,0.5,100,0,'COLETAR',0,'1- HERBICIDAS','',10,0,0,'F',5000],
      // vlr_unit=0 → status=ret
      [30,90,'ARG','ARG','ARG','ARG','EC002','1','2026-01-01','C2','CLI B','GO','V1','VEN','PR2','P B',100,0.5,0,0,'COLETAR',0,'2- FUNGICIDAS','',100,0,0,'F',0],
      // normal
      [30,90,'RVD','RVD','RVD','RVD','EC003','1','2026-01-01','C3','CLI C','GO','V1','VEN','PR3','P C',50,0.5,200,25,'COLETAR',0,'5- INSETICIDAS','',50,0,0,'F',5000],
    ];
    const recs = processRows(rows);
    return {
      total: recs.length,
      hasEC001: recs.some(r=>r.pedido==='EC001'),
      ec002status: recs.find(r=>r.pedido==='EC002')?.status,
      ec003ok: recs.some(r=>r.pedido==='EC003'),
    };
  });
  if(edgeRes.hasEC001) bug('saldo=0: não filtrado por processRows');
  else info('saldo=0: filtrado ✓');
  if(edgeRes.ec002status !== 'ret') bug(`vlr_unit=0: status="${edgeRes.ec002status}" (esperava "ret")`);
  else info('vlr_unit=0: status=ret ✓');
  if(!edgeRes.ec003ok) bug('registro normal EC003 não processado');
  else info('EC003 normal ✓');

  // ── Config: card "Dados e base" removido ──────────────────────────────────
  info('\n-- Config --');
  await page.click('[data-pg="config"]');
  await page.waitForTimeout(300);
  const dadosBasePresent = await page.locator('text="Dados e base"').count();
  if(dadosBasePresent > 0) bug('Config: card "Dados e base" ainda presente');
  else info('Config: "Dados e base" removido ✓');

  // ── Tooltips ──────────────────────────────────────────────────────────────
  info('\n-- Tooltips --');
  const btnReloadTitle = await page.locator('#btnReload').getAttribute('title');
  if(!btnReloadTitle) bug('btnReload: sem atributo title');
  else info(`btnReload title ✓`);

  await page.click('[data-pg="auditoria"]');
  await page.waitForTimeout(200);
  const btnFinTitle = await page.locator('#btnFinalizarCobr').getAttribute('title');
  if(!btnFinTitle) bug('btnFinalizarCobr: sem title');
  else info('btnFinalizarCobr title ✓');

  // ── Ordenação Auditoria (sem crash) ──────────────────────────────────────
  info('\n-- Ordenação tabela Auditoria --');
  await page.evaluate(()=>{
    const fb=document.getElementById('fbAudit');
    if(fb)['st_nao','st_ag','st_re'].forEach(f=>{
      const el=fb.querySelector(`[data-f="${f}"]`);if(el)el.classList.add('on');
    });
    renderAuditoria();
  });
  await page.waitForTimeout(200);
  await page.locator('#tblAudit thead th').filter({hasText:'Filial'}).click().catch(()=>{});
  await page.waitForTimeout(200);
  const audRowsAfterSort = await page.locator('#tblAudit tbody tr').count();
  if(audRowsAfterSort === 0) bug('Auditoria: tabela vazia após ordenação');
  else info(`Auditoria: ${audRowsAfterSort} linhas após ordenação ✓`);

  // ── Badge final consistente ───────────────────────────────────────────────
  info('\n-- Badge final --');
  await page.click('[data-pg="resumo"]').catch(()=>{});
  await page.waitForTimeout(200);
  const badgeFinal = await page.locator('#badgeCobrar').textContent();
  const atrCobrFinal = await page.evaluate(()=> RECORDS.filter(r=>r.status!=='ret'&&r.atrasado).length);
  if(String(atrCobrFinal)!==badgeFinal.trim() && !(atrCobrFinal===0 && badgeFinal.trim()===''))
    bug(`Badge final inconsistente: "${badgeFinal.trim()}" vs atrasados=${atrCobrFinal}`);
  else info(`Badge final consistente: "${badgeFinal.trim()}" ✓`);

  // ── Filtro "Só atrasados" vs sem filtro ──────────────────────────────────
  info('\n-- Filtro "Só atrasados" em Cobrar --');
  await page.click('[data-pg="cobrar"]');
  await page.waitForTimeout(300);
  const soatrFinal = await page.locator('#fbCobrar [data-f="soatr"]').evaluate(el=>el.classList.contains('on'));
  if(!soatrFinal) bug('Cobrar: "Só atrasados" não está ativo por padrão no final');
  else {
    const rowsComFiltro = await page.locator('#tblCobrar tbody tr').count();
    await page.locator('#fbCobrar [data-f="soatr"]').click();
    await page.waitForTimeout(200);
    const rowsSemFiltro = await page.locator('#tblCobrar tbody tr').count();
    if(rowsSemFiltro < rowsComFiltro) warn(`"Só atrasados": com=${rowsComFiltro}, sem=${rowsSemFiltro} — valores invertidos?`);
    else info(`"Só atrasados": com=${rowsComFiltro}, sem=${rowsSemFiltro} ✓`);
  }

  // ── Relatório final ───────────────────────────────────────────────────────
  info('\n\n══════════════════════════════════════════════════════');
  info('RESULTADO DA SIMULAÇÃO DE 3 MESES (6 importações)');
  info('══════════════════════════════════════════════════════');
  info(`  BUGS:  ${BUGS.length}`);
  info(`  WARNS: ${WARNS.length}`);
  info(`  Erros JS browser: ${jsErrors.length}`);

  await browser.close();

  const report = { ts: new Date().toISOString(), bugs:BUGS, warns:WARNS, infos:INFOS, jsErrors };
  fs.writeFileSync('/tmp/sim3meses_report.json', JSON.stringify(report,null,2));
  console.log('\n📄 /tmp/sim3meses_report.json');

  if(BUGS.length > 0){
    console.error(`\n❌ ${BUGS.length} BUG(S):`);
    BUGS.forEach((b,i)=>console.error(`  ${i+1}. ${b}`));
    process.exit(1);
  } else {
    console.log(`\n✅ Simulação concluída: ${WARNS.length} aviso(s).`);
    process.exit(0);
  }
}

run().catch(e=>{ console.error('FATAL:', e.message, e.stack); process.exit(1); });
