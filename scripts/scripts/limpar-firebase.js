const admin = require('firebase-admin');

// Pega o JSON de dentro do Secret do GitHub
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function limparCheckboxes() {
  console.log('Iniciando limpeza no Firestore...');

  try {
    // 1. Apontar para a coleção 'employees'
    const collectionRef = db.collection('employees');
    
    // 2. Buscar TODOS os documentos da coleção
    const snapshot = await collectionRef.get();

    if (snapshot.empty) {
      console.log('Nenhum documento encontrado na coleção "employees".');
      return;
    }

    // 3. Preparar um "lote" de atualizações (é mais rápido)
    const batch = db.batch();

    snapshot.forEach(doc => {
      console.log(`Preparando atualização para o documento: ${doc.id}`);
      const docRef = db.collection('employees').doc(doc.id);
      
      // 4. Adicionar a atualização ao lote
      // Usando os nomes exatos da sua imagem: assDss, bem, mal
      batch.update(docRef, {
        assDss: false,
        bem: false,
        mal: false
      });
    });
    
    // 5. Executar todas as atualizações de uma vez
    await batch.commit();
    
    console.log(`Sucesso! ${snapshot.size} documentos foram atualizados.`);

  } catch (error) {
    console.error('ERRO ao limpar checkboxes:', error);
    process.exit(1); // Faz o GitHub Action falhar
  }
}

// Roda a função
limparCheckboxes();
