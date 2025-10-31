[V0.0.1] - SIMPLE MEDIASOUP DEMO

  Mudanças importantes:
    * 1 producer fixo e 1 producer variável.
    * client Upstreams alterado para ser array: no máximo dois transports.
    * Máximo de 2 producers ativos simultaneamente.
    * Front simplificado (nenhuma estrutura) usado para testar funcionalidedes do mediasoup.
    * Funcionalidades básicas implementadas e testadas: transmitir video da webcam, audio do microfone (obrigatório para producers), video e audio da tela (desktop);
    mutar microfone, fechar camera e fechar/abir screenSharing; sair da sala para criador, consumer, producer e servidor (fechar a sala).

  Pontos a melhorar:
    * Estrutura do front 
    * Integrar com Api interna (gerenciamento de usuários, regras de acessos, etc..)
