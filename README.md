# Li & Entendi

> Tornar textos jurídicos compreensíveis para qualquer pessoa.

## O que é
O Li & Entendi é um site que pega contratos, termos de uso ou qualquer documento jurídico e traduz para uma linguagem direta. A ideia é aliviar a dor de quem precisa assinar algo, mas não domina o “juridiquês”. A aplicação também aponta cláusulas importantes, sugere perguntas e monta um glossário com os termos mais chatos.

## Como funciona
1. Cole o texto original no campo “Entrada de texto”.
2. Escolha o nível de simplificação (Adolescente, Português Claro ou Técnico Simplificado).
3. Clique em “Simplificar com IA”. Sem API Key o site usa um modo offline básico; com uma chave do Google Gemini ele gera um resultado mais completo.
4. Veja o resultado dividido em abas: comparação lado a lado, resumo, cláusulas importantes, glossário, pontos de atenção e perguntas sugeridas. Tudo pode ser copiado rapidamente.

## Por que existe
Durante a Imersão Dev Alura + Google 2025 ficou claro que muita gente tem receio de assinar contratos por causa da linguagem complicada. O projeto mostra, de forma prática, como IA pode servir para orientar decisões mais conscientes.

## Como usar
- Faça o deploy (GitHub Pages resolve) ou abra o `index.html` localmente.
- Clique em “🔑 API Key” e informe sua chave do Google AI Studio para liberar o modo completo. A chave fica guardada apenas no seu navegador.
- Cole o documento, escolha o modo, execute e explore os atalhos de copiar ou compartilhar. O histórico local mantém as três últimas consultas.

## Tecnologias
- HTML, CSS e JavaScript puro
- Integração com Google Gemini via fetch API
- LocalStorage para histórico e preferências

## Autor
Pedro Lucas Ferreira Bosa — pedrolucasfbosa@gmail.com
