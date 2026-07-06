const { chromium } = require('playwright');

async function run(){
  const browser = await chromium.launch({ headless: true, args:['--no-sandbox'] });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  const consoleErrors = [];
  page.on('console', msg => {
    console.log(`[browser ${msg.type()}]:`, msg.text());
  });
  page.on('pageerror', err => console.error('[pageerror]:', err.message));

  await page.goto('file:///home/user/Entrega-Futura/index.html', { waitUntil: 'domcontentloaded', timeout:15000 });
  await page.waitForTimeout(1000);

  // Build minimal test data: just 3 items — 1 total (atrasado), 1 ret (atrasado), 1 total (normal)
  const result = await page.evaluate(() => {
    const header = [
      'Dias Pendentes','Limite x Lin','Filial NF','Sigla NF',
      'Filial Ped','Sigla Ped','N° Pedido','Desd','Emissão NF',
      'Cliente','Nome Cliente','Cidade','Vendedor','Nome Vendedor',
      'Produto','Descrição Produto','Saldo','Peso Unit','Valor Unitário',
      'Peso Total','Tipo Entrega','Valor Frete','Linha','Sublinha',
      'Qtde Vnd','Qtde Entr','Qtde Dev','Fornecedor','Vlr Saldo (Título)'
    ];
    // dias=100, limite=90, saldo=10, vlr=100, devido=0 → atrasado, total (cobrável)
    const row1 = [100,90,'MTZ','MTZ','MTZ','MTZ','P001','1','2026-01-01','C001','CLIENTE A','CID','V001','VEND A','PR001','PROD A',10,1,100,10,'COLETAR',0,'1- HERBICIDAS','',10,0,0,'FORN',0];
    // dias=100, limite=90, saldo=10, vlr=100, devido=1000 → atrasado, ret (não cobrável)
    const row2 = [100,90,'ARG','ARG','ARG','ARG','P002','1','2026-01-01','C002','CLIENTE B','CID','V001','VEND A','PR002','PROD B',10,1,100,10,'COLETAR',0,'1- HERBICIDAS','',10,0,0,'FORN',1000];
    // dias=10, limite=90, saldo=5, vlr=50, devido=0 → normal, total (cobrável)
    const row3 = [10,90,'RVD','RVD','RVD','RVD','P003','1','2026-03-01','C003','CLIENTE C','CID','V001','VEND A','PR003','PROD C',5,1,50,5,'COLETAR',0,'1- HERBICIDAS','',5,0,0,'FORN',0];

    window.RECORDS = processRows([header, row1, row2, row3]);
    window.dataRef = new Date('2026-04-05');
    window.COMP = null;
    window.sortState = {};

    const beforeBoot = document.getElementById('badgeCobrar').textContent;
    window.bootApp(true);
    const afterBoot = document.getElementById('badgeCobrar').textContent;

    return {
      recordCount: window.RECORDS.length,
      records: window.RECORDS.map(r=>({sigla:r.sigla,status:r.status,atrasado:r.atrasado,dias:r.dias,limite:r.limite})),
      atrCobrar: window.RECORDS.filter(r=>r.status!=='ret'&&r.atrasado).length,
      badgeBeforeBoot: beforeBoot,
      badgeAfterBoot: afterBoot,
    };
  });

  console.log('Result:', JSON.stringify(result, null, 2));

  // Wait and check again
  await page.waitForTimeout(2000);
  const badgeAfterWait = await page.locator('#badgeCobrar').textContent();
  const atrNow = await page.evaluate(() => window.RECORDS.filter(r=>r.status!=='ret'&&r.atrasado).length);
  console.log(`After 2s wait: badge="${badgeAfterWait}", atrCobrar=${atrNow}`);

  await browser.close();
}

run().catch(e => { console.error(e); process.exit(1); });
