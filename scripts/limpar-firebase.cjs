name: Limpar Checkboxes no Firebase (Manual)

on:
  workflow_dispatch: 

jobs:
  limpar-dados-firebase:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout código
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20' 

      - name: Instalar dependências
        run: npm install

      # ---- PASSO DE DEBUG MAIS FOCADO ----
      - name: Listar arquivos na pasta 'scripts' (debug)
        run: ls -l scripts
      # ------------------------------------

      - name: Rodar script de limpeza
        run: node scripts/limpar-firebase.cjs 
        env:
          FIREBASE_SERVICE_ACCOUNT_JSON: ${{ secrets.FIREBASE_SERVICE_ACCOUNT_JSON }}
