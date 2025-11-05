# Simple Mediasoup Demo (v0.0.1)

## 🔧 Mudanças Importantes
- 1 *producer* fixo e 1 *producer* variável.  
- `client Upstreams` alterado para ser um **array** (máximo de dois *transports*).  
- Máximo de **2 producers ativos simultaneamente**.  
- **Front simplificado** (sem estrutura complexa) utilizado para testes de funcionalidades do Mediasoup.  
- Funcionalidades básicas implementadas e testadas:
  - Transmissão de vídeo da **webcam**  
  - Transmissão de áudio do **microfone** (obrigatório para *producers*)  
  - Transmissão de vídeo e áudio da **tela (screen sharing)**  
  - **Mutar microfone**, **fechar câmera**, **fechar/abrir compartilhamento de tela**  
  - **Sair da sala** (para criador, *consumer*, *producer* e servidor — encerrando a sala)

---

## Pontos a Melhorar
- Estrutura do **frontend**  
- Integração com **API interna** (gerenciamento de usuários, regras de acesso, etc.)
