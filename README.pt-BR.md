# Cabeaí

**Será que cabe?** Monte a planta da sua casa em escala, coloque os móveis e veja se dá para passar, abrir as portas e sentar à mesa. Grátis, de código aberto e com IA.

**Use agora:** https://cabeai.howlks.com

*Read in English: [README.md](README.md)*

- Casa com **andares** e **cômodos**: veja um cômodo, os cômodos **lado a lado** ou a **planta da casa montada** (andares lado a lado, cômodos arrastáveis, com ímã que encosta as paredes e setas com a distância entre eles).
- **Portas, janelas, ar-condicionado, interruptores e tomadas** em cada parede. Uma porta na parede dividida entre dois cômodos vale para os dois.
- **Móveis com medidas reais**: cama (com **baú** na cabeceira, nos pés ou nos dois, mais largo que a cama, centralizado, à esquerda, à direita ou com ajuste), guarda-roupa, berço, cômoda, **mesa com cadeiras** (na frente, dos dois lados ou em volta, com o espaço para puxar), cadeira, sofá, rack, estante, geladeira, fogão, pia, lavadora, armário e outros.
- **Espaço livre na frente** de cada móvel calculado pelas portas e gavetas, e editável para móveis planejados.
- **Avisos** quando algo não cabe: porta batendo em móvel, janela tapada, interruptor ou tomada coberta, cadeira sem espaço, cômodos um em cima do outro.
- **Cenários** para comparar arrumações de um cômodo ou da casa toda (atualize o que está em uso ou salve um novo), e **3 sugestões** automáticas ou pela **IA**.
- Tudo fica **salvo no navegador**; dá para **exportar e importar** um arquivo.
- Funciona no **celular** e no **computador**, em modo **simples** ou **avançado** (painel de propriedades, posição exata, travar móveis), em **português** e **inglês**.

## IA grátis

O Cabeaí tem três jeitos de sugerir arrumações, todos sem custo:

1. **Sugestões automáticas**: um motor de regras que roda no navegador. Sempre disponível.
2. **IA online** (`/api/ia`): usa os modelos **gratuitos do AI Gateway da Vercel**. Na Vercel a autenticação é automática (OIDC), sem chave nenhuma. Se preferir o **Gemini** do Google, crie uma chave grátis no [Google AI Studio](https://aistudio.google.com/apikey) e coloque em `GOOGLE_GENERATIVE_AI_API_KEY`.
3. **IA do navegador**: no Google Chrome do computador (versões novas, com o Gemini Nano embutido), a IA roda no próprio aparelho, sem enviar nada.

Toda resposta da IA é conferida com as medidas antes de aparecer: móveis são trazidos para dentro do cômodo e os problemas são contados. Se sobrar algum problema, a IA recebe a lista e tenta corrigir uma vez.

## Rodar no seu computador

Precisa do [Node.js](https://nodejs.org) 22 ou mais novo.

```bash
git clone https://github.com/HerbertJulio/cabeai.git
cd cabeai
npm install
npm run dev
```

Abra http://localhost:3000. Para a IA online funcionar localmente, crie um `.env.local` (veja `.env.example`) com `AI_GATEWAY_API_KEY` ou `GOOGLE_GENERATIVE_AI_API_KEY`.

```bash
npm test          # testes (Vitest)
npm run typecheck # TypeScript
npm run build     # build de produção
```

## Publicar

O repositório está ligado à Vercel: cada `git push` na `main` publica sozinho, e cada pull request ganha um endereço de prévia. Para publicar uma cópia sua, importe o repositório em [vercel.com/new](https://vercel.com/new).

## Privacidade

Não tem conta, cadastro nem rastreamento. A planta fica no navegador de quem usa. Só quando alguém toca em "Pedir à IA" é que os dados daquele cômodo vão para a IA escolhida, e nada é guardado no servidor.

## Apoie o projeto

O Cabeaí é grátis e sem anúncios. Se ele te ajudou, você pode apoiar:

- [GitHub Sponsors](https://github.com/sponsors/HerbertJulio)
- PIX (chave e-mail): hvcotta@gmail.com

Ideias e problemas são bem-vindos nas [issues](https://github.com/HerbertJulio/cabeai/issues).

## Licença

[MIT](LICENSE). Fontes Barlow e Barlow Condensed sob a [SIL Open Font License](app/fontes/OFL-Barlow.txt).
