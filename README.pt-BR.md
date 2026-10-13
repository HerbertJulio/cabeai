# Cabeaí

**Será que cabe?** Monte a planta da sua casa em escala, coloque os móveis e veja se dá para passar, abrir as portas e sentar à mesa. Grátis, de código aberto e com IA.

**Use agora:** https://cabeai.howlks.com

*Read in English: [README.md](README.md)*

- **Desenhe a planta** arrastando o dedo ou o mouse: escolha sala, quarto, banheiro, cozinha, corredor, varanda… Arraste o cômodo pelo piso ou pelo nome para mudar de lugar; perto de outro cômodo as paredes grudam, e corredor e varanda já ganham porta ou passagem para os cômodos que tocam (e ela sai se eles se separarem). Na barra de desenhar, escolha Porta, De correr, Passagem ou Janela e toque numa parede para pôr ali.
- **Tire a parede** entre dois cômodos e eles viram um espaço só (um cômodo em L, por exemplo); dá para pôr a parede de volta quando quiser.
- **Foto do desenho em papel**: tire uma foto do rascunho e a IA monta os cômodos, os corredores, as portas e as janelas.
- Casa com **andares** e **cômodos**: veja um cômodo, os cômodos **lado a lado** ou a **planta da casa montada** (andares lado a lado; cômodos que se arrastam, esticam pelas paredes e giram, com ímã que encosta as paredes e setas com a distância entre eles).
- **Planta com cara de projeto de arquiteto**: cada cômodo ganha o piso do tipo dele (madeira no quarto, porcelanato na sala e no corredor, cerâmica no banheiro, deck na varanda), os móveis têm uma sombra leve e o nome do cômodo fica longe dos móveis. Tocar num móvel, numa porta ou num cômodo mostra uma **barra de ações** logo em cima dele (girar, duplicar, editar, virar a porta e Mais para o resto); no modo de desenhar ela fica embaixo, junto das ferramentas, para não cobrir as paredes.
- **Portas, janelas, ar-condicionado e pontos** em cada parede: interruptor, tomada, arandela, TV, internet, água, esgoto e gás. A porta pode ser de abrir, dupla, de correr ou só a passagem (vão livre).
- **A porta é da parede**, não de um cômodo só: dá para tocar nela pelos dois lados, e o painel diz para que cômodo ela abre, pelo nome. Com ela selecionada, a barra de ações vira a porta: um botão diz para que cômodo ela vai abrir, pelo nome, e o outro troca o lado da dobradiça (ou, na porta de correr, o lado para onde ela corre). As portas automáticas ficam perto do canto, abrindo encostadas na parede, como se faz na obra.
- Coloque um cômodo **à direita, à esquerda, acima ou abaixo** de outro, crie **corredores** ligando dois cômodos com o comprimento que quiser e **escadas retas ou caracol**.
- **Móveis com medidas reais**: cama (com **baú** na cabeceira, nos pés ou nos dois, mais largo que a cama, centralizado, à esquerda, à direita ou com ajuste), guarda-roupa, berço, cômoda, criado-mudo, **mesa com cadeiras** (na frente, dos dois lados ou em volta, com o espaço para puxar), cadeira, sofá, poltrona, rack, estante, geladeira, fogão, pia, lavadora, tanque, armário, vaso sanitário, pia do banheiro, box, banheira e outros.
- **Espaço livre na frente** de cada móvel calculado pelas portas e gavetas, e editável para móveis planejados.
- **Avisos** quando algo não cabe: porta batendo em móvel, janela tapada, interruptor, tomada ou outro ponto tapado, cadeira sem espaço, cômodos um em cima do outro.
- **Cenários** para comparar arrumações de um cômodo ou da casa toda (atualize o que está em uso ou salve um novo), e **3 sugestões** automáticas ou pela **IA**, que põem o rack no ponto de TV, a pia e a máquina de lavar na água e no esgoto e o fogão no gás.
- **Desfazer e refazer** (↶ ↷ no topo, ou Ctrl+Z e Ctrl+Shift+Z), **histórico** de tudo o que mudou e **pontos de restauração**, que guardam a casa inteira no navegador (automáticos e os seus) para voltar depois.
- **Esconda os móveis** (ou portas e janelas, ar-condicionado, pontos, nomes, o piso e a grade) para mexer no que está por baixo, use a **trena** para medir qualquer distância e veja a **área** de cada cômodo, andar e da casa, com o chão livre.
- **Duplique um cômodo** com tudo dentro, **copie e cole** móveis e itens de parede, veja o **resumo com a lista de móveis** para copiar e **salve a planta como imagem** (PNG, ou compartilhe no celular).
- Tudo fica **salvo no navegador**; dá para **exportar e importar** um arquivo. Tema claro, escuro ou automático.
- Funciona no **celular** e no **computador**, em modo **simples** ou **avançado** (painel de propriedades, posição exata, travar móveis), em **português** e **inglês**.

## IA grátis

O Cabeaí tem três jeitos de sugerir arrumações, todos sem custo:

1. **Sugestões automáticas**: um motor de regras que roda no navegador. Sempre disponível.
2. **IA online** (`/api/ia`): usa os modelos **gratuitos do AI Gateway da Vercel**. Na Vercel a autenticação é automática (OIDC), sem chave nenhuma. Se preferir o **Gemini** do Google, crie uma chave grátis no [Google AI Studio](https://aistudio.google.com/apikey) e coloque em `GOOGLE_GENERATIVE_AI_API_KEY`.
3. **IA do navegador**: no Google Chrome do computador (versões novas, com o Gemini Nano embutido), a IA roda no próprio aparelho, sem enviar nada.

Para **montar a planta pela foto do desenho** (`/api/planta`), a IA precisa ler imagem: coloque a chave grátis do Gemini em `GOOGLE_GENERATIVE_AI_API_KEY` (ou escolha um modelo com visão do AI Gateway em `CABEAI_MODELO_VISAO`). Sem isso, o botão avisa que a IA de fotos não está ligada, e dá para desenhar a planta direto no app.

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

## Como o código está organizado

```
app/            páginas (Next.js App Router), estilos, fontes e as rotas /api/ia e /api/planta
components/     a tela em React (planta em SVG, barra de ações, dock, painéis, diálogos, menus)
  desenho/      o desenho em escala dos cômodos, dos pisos e dos móveis (1 unidade = 1 cm)
lib/            a lógica sem tela: geometria, avisos, casa, sugestões, IA, dados, idiomas
tests/          testes (Vitest)
```

O `lib/store.ts` guarda o estado e é o único lugar que muda a casa; o resto de `lib/` só calcula: `geometria.ts` (medidas e avisos), `casa.ts` (planta da casa, ímã e a mesma porta vista dos dois lados da parede), `edicao.ts` (girar, esticar, portas automáticas perto do canto, porta ou janela posta com um toque na parede e paredes tiradas), `consultas.ts`, `historico.ts` (desfazer, refazer e pontos de restauração), `resumo.ts` (áreas e resumo), `exportar.ts` (imagem da planta), `motor.ts` (sugestões), `ia.ts` e `planta.ts` (IA).

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
