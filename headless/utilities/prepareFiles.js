const fs = require("fs");

const prepareFiles = async (files, sessionId) => {
    /* esta função precisa:
        1. listar os arquivos e verificar se é remoto: 
            se é remoto:
                -> procurar downloads relacionados
                -> verificar se já estão os arquivos
                -> pegar path completo do endereço dos downloads
            se é local:
                -> verificar se existe
                -> pegar path local 
                
        2. criar concat file
        3. retornar concatFle 
    */

    
}

module.exports = prepareFiles