const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

// --- 1. CONFIGURAÇÕES ---
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;
const EMAIL_TO = process.env.EMAIL_TO;

// Inicializa o app PADRÃO
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS,
  },
});

// --- FUNÇÃO AUXILIAR DE LIMPEZA (A "ARMA SECRETA") ---
function limparTexto(texto) {
  if (!texto) return ""; // Se estiver vazio, retorna vazio
  
  // 1. Força converter para string (caso venha como objeto)
  let str = String(texto);
  
  // 2. Substitui TODAS as quebras de linha (\r, \n) por um espaço simples
  str = str.replace(/(\r\n|\n|\r)/gm, " ");
  
  // 3. Remove espaços duplos (ex: "Ana  Paula" vira "Ana Paula")
  str = str.replace(/\s+/g, " ");
  
  return str.trim();
}

// --- 2. FUNÇÃO DE LER E PREPARAR OS DADOS ---
async function gerarRelatorio() {
  console.log("Iniciando geração do relatório...");

  const cat_7H_EstouBem = [], cat_7H_EstouMal = [], cat_7H_Ausentes = [];
  const cat_6H_EstouBem = [], cat_6H_EstouMal = [], cat_6H_Ausentes = [];
  
  const registros7H = [];
  const registros6H = [];
  
  let totalFuncionarios = 0;

  // A) Ler dados dos 'employees' e LIMPAR NA FONTE
  try {
    const empRef = db.collection('employees');
    const empSnapshot = await empRef.get();
    totalFuncionarios = empSnapshot.size;
    
    empSnapshot.forEach(doc => {
      const dados = doc.data();
      
      // --- AQUI ESTÁ A MÁGICA: Limpamos tudo AGORA ---
      const emp = {
        ...dados,
        name: limparTexto(dados.name),
        matricula: limparTexto(dados.matricula),
        turno: limparTexto(dados.turno)
      };

      // Lógica de separação
      if (emp.mal === true) {
        if (emp.turno === "6H") cat_6H_EstouMal.push(emp);
        else cat_7H_EstouMal.push(emp);
      
      } else if (emp.assDss === true && emp.bem === true) {
        if (emp.turno === "6H") cat_6H_EstouBem.push(emp);
        else cat_7H_EstouBem.push(emp);
      
      } else {
        // Se não está Mal e não está Bem+DSS, é Pendente/Ausente
        if (emp.turno === "6H") cat_6H_Ausentes.push(emp);
        else cat_7H_Ausentes.push(emp);
      }
    });
  } catch (error) {
    console.error("Erro ao ler 'employees':", error);
    return "<h1>Erro ao ler o banco de dados.</h1>";
  }

  // B) Ler dados dos 'registrosDSS' e LIMPAR NA FONTE
  try {
    const regRef = db.collection('registrosDSS');
    const regSnapshot = await regRef.get();
    
    regSnapshot.forEach(doc => {
      const dados = doc.data();
      
      // --- Limpeza imediata ---
      const reg = {
        ...dados,
        assunto: limparTexto(dados.assunto),
        matricula: limparTexto(dados.matricula),
        TURNO: limparTexto(dados.TURNO)
      };

      if (reg.TURNO === "6H") registros6H.push(reg);
      else registros7H.push(reg);
    });
  } catch (error) {
    console.error("Erro ao ler 'registrosDSS':", error);
  }

  // --- 3. MONTAR O CORPO DO E-MAIL ---
  // Usamos <pre> com estilo para garantir quebras de linha só onde queremos
  let htmlBody = `<pre style="font-family: monospace; font-size: 14px; white-space: pre-wrap;">`;
  
  const totalPresentes = cat_7H_EstouBem.length + cat_7H_EstouMal.length + cat_6H_EstouBem.length + cat_6H_EstouMal.length;
  const totalAusentes = cat_7H_Ausentes.length + cat_6H_Ausentes.length;
  
  htmlBody += `RESUMO GERAL<br>`;
  htmlBody += `--------------------------------------------------<br>`;
  htmlBody += `- Total de Funcionários: ${totalFuncionarios}<br>`;
  htmlBody += `- Presentes (DSS + Bem/Mal): ${totalPresentes}<br>`;
  htmlBody += `- Pendentes / Ausentes: ${totalAusentes}<br><br>`;

  // --- EQUIPE TURNO 7H ---
  htmlBody += `EQUIPE TURNO 7H-19H<br>`; 
  htmlBody += `--------------------------------------------------<br><br>`;
  
  htmlBody += `STATUS: "ASS.DSS + ESTOU BEM"<br>`;
  htmlBody += `--------------------------------------------------<br>`;
  if (cat_7H_EstouBem.length === 0) htmlBody += `Nenhum<br>`;
  cat_7H_EstouBem.forEach(emp => { htmlBody += `${emp.name} (Matrícula: ${emp.matricula})<br>`; });
  htmlBody += `<br>`;
  
  htmlBody += `STATUS "ESTOU MAL"<br>`;
  htmlBody += `--------------------------------------------------<br>`;
  if (cat_7H_EstouMal.length === 0) htmlBody += `Nenhum<br>`;
  cat_7H_EstouMal.forEach(emp => { htmlBody += `${emp.name} (Matrícula: ${emp.matricula})<br>`; });
  htmlBody += `<br>`;

  htmlBody += `PENDENTES / AUSENTES<br>`;
  htmlBody += `--------------------------------------------------<br>`;
  if (cat_7H_Ausentes.length === 0) htmlBody += `Nenhum<br>`;
  cat_7H_Ausentes.forEach(emp => { htmlBody += `${emp.name} (Matrícula: ${emp.matricula})<br>`; });
  htmlBody += `<br><br>`;

  // --- EQUIPE TURNO 6H ---
  htmlBody += `EQUIPE TURNO 6H<br>`;
  htmlBody += `--------------------------------------------------<br><br>`;
  
  htmlBody += `STATUS: "ASS.DSS + ESTOU BEM"<br>`;
  htmlBody += `--------------------------------------------------<br>`;
  if (cat_6H_EstouBem.length === 0) htmlBody += `Nenhum<br>`;
  cat_6H_EstouBem.forEach(emp => { htmlBody += `${emp.name} (Matrícula: ${emp.matricula})<br>`; });
  htmlBody += `<br>`;
  
  htmlBody += `STATUS "ESTOU MAL"<br>`;
  htmlBody += `--------------------------------------------------<br>`;
  if (cat_6H_EstouMal.length === 0) htmlBody += `Nenhum<br>`;
  cat_6H_EstouMal.forEach(emp => { htmlBody += `${emp.name} (Matrícula: ${emp.matricula})<br>`; });
  htmlBody += `<br>`;

  htmlBody += `PENDENTES / AUSENTES<br>`;
  htmlBody += `--------------------------------------------------<br>`;
  if (cat_6H_Ausentes.length === 0) htmlBody += `Nenhum<br>`;
  cat_6H_Ausentes.forEach(emp => { htmlBody += `${emp.name} (Matrícula: ${emp.matricula})<br>`; });
  htmlBody += `<br><br>`;
  
  // --- REGISTROS DE ASSUNTO DSS ---
  
  htmlBody += `REGISTROS DSS (TURNO 7H-19H)<br>`;
  htmlBody += `--------------------------------------------------<br>`;
  if (registros7H.length === 0) {
    htmlBody += `Nenhum registro de assunto encontrado para 7H-19H.<br>`;
  } else {
    registros7H.forEach(reg => {
      htmlBody += `Assunto: ${reg.assunto} (Matrícula: ${reg.matricula})<br>`;
    });
  }
  htmlBody += `<br>`;

  htmlBody += `REGISTROS DSS (TURNO 6H)<br>`;
  htmlBody += `--------------------------------------------------<br>`;
  if (registros6H.length === 0) {
    htmlBody += `Nenhum registro de assunto encontrado para 6H.<br>`;
  } else {
    registros6H.forEach(reg => {
      htmlBody += `Assunto: ${reg.assunto} (Matrícula: ${reg.matricula})<br>`;
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
