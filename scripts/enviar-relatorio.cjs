// scripts/enviar-relatorio.cjs
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

// --- 1. CONFIGURAÇÕES ---
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;
const EMAIL_TO = process.env.EMAIL_TO;

// --- CORREÇÃO AQUI ---
// Inicializa o app PADRÃO (default). Não precisa de nome.
// O script de limpeza (limpar-firebase.cjs) também inicializa o app padrão,
// mas como eles rodam em workflows SEPARADOS (1h e 10h), eles nunca vão
// entrar em conflito.
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// Agora este comando vai achar o app padrão
const db = admin.firestore();

// Configura o "Carteiro"
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS,
  },
});

// --- 2. FUNÇÃO DE LER OS DADOS (O Relatório) ---
async function gerarRelatorio() {
  console.log("Iniciando geração do relatório...");

  // Arrays para funcionários
  const funcionarios = [];
  const cat_7H_EstouBem = [], cat_7H_EstouMal = [], cat_7H_Ausentes = [];
  const cat_6H_EstouBem = [], cat_6H_EstouMal = [], cat_6H_Ausentes = [];
  
  // Arrays para os registros DSS
  const registros7H = [];
  const registros6H = [];

  // A) Ler dados dos 'employees'
  try {
    const empRef = db.collection('employees');
    const empSnapshot = await empRef.get();
    
    empSnapshot.forEach(doc => {
      const emp = doc.data();
      funcionarios.push(emp);

      // Lendo o campo 'turno' (minúsculo)
      if (emp.turno === "6H") { 
        if (emp.mal === true) cat_6H_EstouMal.push(emp);
        else if (emp.assDss === true && emp.bem === true) cat_6H_EstouBem.push(emp);
        else cat_6H_Ausentes.push(emp);
      } else {
        if (emp.mal === true) cat_7H_EstouMal.push(emp);
        else if (emp.assDss === true && emp.bem === true) cat_7H_EstouBem.push(emp);
        else cat_7H_Ausentes.push(emp);
      }
    });
  } catch (error) {
    console.error("Erro ao ler 'employees':", error);
    return "<h1>Erro ao ler o banco de dados 'employees'.</h1>";
  }

  // B) Ler dados dos 'registrosDSS'
  try {
    const regRef = db.collection('registrosDSS');
    const regSnapshot = await regRef.get();
    
    regSnapshot.forEach(doc => {
      const reg = doc.data();
      // Lendo 'reg.TURNO' (MAIÚSCULO)
      if (reg.TURNO === "6H") {
        registros6H.push(reg);
      } else {
        registros7H.push(reg);
      }
    });
  } catch (error) {
    console.error("Erro ao ler 'registrosDSS':", error);
  }

  // --- 3. MONTAR O CORPO DO E-MAIL ---
  let htmlBody = `<pre>`;
  
  const totalPresentes = cat_7H_EstouBem.length + cat_7H_EstouMal.length + cat_6H_EstouBem.length + cat_6H_EstouMal.length;
  const totalAusentes = cat_7H_Ausentes.length + cat_6H_Ausentes.length;
  
  htmlBody += `RESUMO GERAL\n`;
  htmlBody += `--------------------------------------------------\n`;
  htmlBody += `- Total de Funcionários: ${funcionarios.length}\n`;
  htmlBody += `- Presentes: ${totalPresentes}\n`;
  htmlBody += `- Ausentes: ${totalAusentes}\n\n`;

  // --- EQUIPE TURNO 7H ---
  htmlBody += `EQUIPE TURNO 7H-19H\n`; 
  htmlBody += `--------------------------------------------------\n\n`;
  htmlBody += `STATUS: "ASS.DSS + ESTOU BEM"\n`;
  htmlBody += `--------------------------------------------------\n`;
  if (cat_7H_EstouBem.length === 0) htmlBody += `Nenhum\n`;
  cat_7H_EstouBem.forEach(emp => { htmlBody += `${emp.name} (Matrícula: ${emp.matricula})\n`; });
  htmlBody += `\n`;
  htmlBody += `STATUS "ESTOU MAL"\n`;
  htmlBody += `--------------------------------------------------\n`;
  if (cat_7H_EstouMal.length === 0) htmlBody += `Nenhum\n`;
  cat_7H_EstouMal.forEach(emp => { htmlBody += `${emp.name} (Matrícula: ${emp.matricula})\n`; });
  htmlBody += `\n`;
  htmlBody += `AUSENTES\n`;
  htmlBody += `--------------------------------------------------\n`;
  if (cat_7H_Ausentes.length === 0) htmlBody += `Nenhum\n`;
  cat_7H_Ausentes.forEach(emp => { htmlBody += `${emp.name} (Matrícula: ${emp.matricula})\n`; });
  htmlBody += `\n\n`;

  // --- EQUIPE TURNO 6H ---
  htmlBody += `EQUIPE TURNO 6H\n`;
  htmlBody += `--------------------------------------------------\n\n`;
  htmlBody += `STATUS: "ASS.DSS + ESTOU BEM"\n`;
  htmlBody += `--------------------------------------------------\n`;
  if (cat_6H_EstouBem.length === 0) htmlBody += `Nenhum\n`;
  cat_6H_EstouBem.forEach(emp => { htmlBody += `${emp.name} (Matrícula: ${emp.matricula})\n`; });
  htmlBody += `\n`;
  htmlBody += `STATUS "ESTOU MAL"\n`;
  htmlBody += `--------------------------------------------------\n`;
  if (cat_6H_EstouMal.length === 0) htmlBody += `Nenhum\n`;
  cat_6H_EstouMal.forEach(emp => { htmlBody += `${emp.name} (Matrícula: ${emp.matricula})\n`; });
  htmlBody += `\n`;
  htmlBody += `AUSENTES\n`;
  htmlBody += `--------------------------------------------------\n`;
  if (cat_6H_Ausentes.length === 0) htmlBody += `Nenhum\n`;
  cat_6H_Ausentes.forEach(emp => { htmlBody += `${emp.name} (Matrícula: ${emp.matricula})\n`; });
  htmlBody += `\n\n`;
  
  // --- REGISTROS DE ASSUNTO DSS (SEPARADOS) ---
  
  htmlBody += `REGISTROS DSS (TURNO 7H-19H)\n`;
  htmlBody += `--------------------------------------------------\n`;
  if (registros7H.length === 0) {
    htmlBody += `Nenhum registro de assunto encontrado para 7H-19H.\n`;
  } else {
    registros7H.forEach(reg => {
      htmlBody += `Assunto: ${reg.assunto} (Matrícula: ${reg.matricula})\n`;
    });
  }
  htmlBody += `\n`;

  htmlBody += `REGISTROS DSS (TURNO 6H)\n`;
  htmlBody += `--------------------------------------------------\n`;
  if (registros6H.length === 0) {
    htmlBody += `Nenhum registro de assunto encontrado para 6H.\n`;
  } else {
    registros6H.forEach(reg => {
      htmlBody += `Assunto: ${reg.assunto} (Matrícula: ${reg.matricula})\n`;
    });
  }

  htmlBody += `</pre>`;
  return htmlBody;
}

// --- 4. FUNÇÃO DE ENVIAR O E-MAIL ---
async function enviarEmail(htmlRelatorio) {
  console.log(`Enviando e-mail para ${EMAIL_TO}...`);
  
  const dataDeHoje = new Date().toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit', month: '2-digit', year: 'numeric'
  });
  const novoAssunto = `Relatório DSS - TURMA B (${dataDeHoje})`;

  const mailOptions = {
    from: EMAIL_USER,
    to: EMAIL_TO,
    subject: novoAssunto, 
    html: htmlRelatorio, 
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log("E-mail enviado com sucesso!");
  } catch (error) {
    console.error("Erro ao enviar e-mail:", error);
    process.exit(1); 
  }
}

// --- 5. FUNÇÃO PRINCIPAL (Ler e Enviar) ---
async function main() {
  console.log("Iniciando script de relatório (10h)...");
  try {
    const htmlRelatorio = await gerarRelatorio();
    await enviarEmail(htmlRelatorio);
    console.log("Script de relatório concluído.");
  } catch (error) {
    console.error('ERRO GERAL NO SCRIPT DE RELATÓRIO:', error);
    process.exit(1);
  }
}

main();
