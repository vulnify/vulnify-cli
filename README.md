# Vulnify CLI

Uma ferramenta de linha de comando para análise de vulnerabilidades em dependências de projetos, similar à CLI da Snyk. A Vulnify CLI se comunica com a API Vulnify SCA Backend para identificar vulnerabilidades de segurança em diferentes ecossistemas de pacotes.

## Características

- 🔍 **Detecção Automática**: Identifica automaticamente arquivos de dependência no projeto
- 🌐 **Múltiplos Ecossistemas**: Suporte para npm, pypi, maven, nuget, rubygems, composer, go, cargo
- 📊 **Relatórios Detalhados**: Gera relatórios em formato JSON e exibe resultados formatados no terminal
- ⚡ **Performance**: Cache inteligente e processamento otimizado
- 🎨 **Interface Rica**: Saída colorida e formatada com spinners e tabelas
- 🔧 **Configurável**: Suporte a arquivos de configuração e variáveis de ambiente

## Instalação

### Instalação Global via NPM (Recomendado)
```bash
npm install -g vulnify
```

Após a instalação, o comando `vulnify` estará disponível globalmente:
```bash
vulnify --version
vulnify help
vulnify test
```

### Instalação Local para Desenvolvimento
```bash
# Clone o repositório
git clone https://github.com/vulnify/vulnify-cli.git
cd vulnify-cli

# Instale as dependências
npm install

# Compile o projeto
npm run build

# Execute a CLI
node dist/cli.js --help
```

### Pré-requisitos
- Node.js >= 14.0.0
- npm ou yarn

## Uso

### Comandos Principais

#### `vulnify test`
Analisa as dependências do projeto atual em busca de vulnerabilidades.

```bash
# Análise automática do projeto atual
vulnify test

# Especificar arquivo de dependências
vulnify test --file package.json

# Forçar ecossistema específico
vulnify test --ecosystem npm

# Formato de saída personalizado
vulnify test --output summary

# Filtrar por severidade
vulnify test --severity high

# Usar chave da API
vulnify test --api-key your-api-key-here
```

**Opções disponíveis:**
- `--file <path>`: Especifica arquivo de dependências
- `--ecosystem <type>`: Força detecção de ecossistema (npm, pypi, maven, etc.)
- `--output <format>`: Formato de saída (table, json, summary)
- `--severity <level>`: Filtra por severidade (critical, high, medium, low)
- `--api-key <key>`: Chave da API para rate limits aumentados
- `--timeout <ms>`: Timeout para requisições (padrão: 30000ms)
- `--no-report`: Pula geração do arquivo report.json

#### `vulnify help`
Exibe informações de ajuda detalhadas.

```bash
vulnify help
```

#### `vulnify --version`
Mostra a versão da CLI.

```bash
vulnify --version
```

#### `vulnify info`
Mostra informações sobre a API e status do serviço.

```bash
vulnify info
```

### Ecossistemas Suportados

| Ecossistema | Arquivos Suportados | Exemplo |
|-------------|-------------------|---------|
| **npm** | package.json, package-lock.json, yarn.lock | `vulnify test --ecosystem npm` |
| **pypi** | requirements.txt, Pipfile, pyproject.toml | `vulnify test --file requirements.txt` |
| **maven** | pom.xml, build.gradle | `vulnify test --ecosystem maven` |
| **nuget** | *.csproj, packages.config | `vulnify test --ecosystem nuget` |
| **rubygems** | Gemfile, Gemfile.lock | `vulnify test --ecosystem rubygems` |
| **composer** | composer.json, composer.lock | `vulnify test --ecosystem composer` |
| **go** | go.mod, go.sum | `vulnify test --ecosystem go` |
| **cargo** | Cargo.toml, Cargo.lock | `vulnify test --ecosystem cargo` |

### Formatos de Saída

#### Table (Padrão)
Exibe resultados em uma tabela formatada com cores.

```bash
vulnify test --output table
```

#### Summary
Mostra um resumo conciso das vulnerabilidades encontradas.

```bash
vulnify test --output summary
```

#### JSON
Saída em formato JSON para integração com outras ferramentas.

```bash
vulnify test --output json
```

### Configuração

#### Arquivo de Configuração
Crie um arquivo `.vulnifyrc` no diretório do projeto ou home:

```json
{
  "api_key": "your-api-key-here",
  "api_url": "https://api-dev.vulnify.io/api/v1",
  "timeout": 30000,
  "severity_threshold": "medium",
  "output_format": "table",
  "generate_report": true,
  "report_filename": "vulnify-report.json"
}
```

#### Variáveis de Ambiente
```bash
export VULNIFY_API_KEY="your-api-key"
export VULNIFY_API_URL="https://api-dev.vulnify.io/api/v1"
export VULNIFY_TIMEOUT="30000"
export VULNIFY_OUTPUT="table"
```

### Relatório JSON

A CLI gera automaticamente um arquivo `vulnify-report.json` com informações detalhadas:

```json
{
  "metadata": {
    "cli_version": "1.0.0",
    "scan_timestamp": "2024-01-15T10:30:00Z",
    "project_path": "/path/to/project",
    "ecosystem": "npm",
    "total_dependencies": 25,
    "scan_duration_ms": 1500
  },
  "summary": {
    "vulnerabilities_found": 8,
    "critical": 1,
    "high": 2,
    "medium": 3,
    "low": 2
  },
  "dependencies": [...],
  "recommendations": [...]
}
```

## Códigos de Saída

- `0`: Análise bem-sucedida, nenhuma vulnerabilidade crítica/alta encontrada
- `1`: Vulnerabilidades críticas ou altas encontradas
- `2`: Erro durante a execução

## Integração com CI/CD

### GitHub Actions
```yaml
- name: Security Scan
  run: |
    npx vulnify-cli test --output json > security-report.json
    if [ $? -eq 1 ]; then
      echo "Critical vulnerabilities found!"
      exit 1
    fi
```

### Jenkins
```groovy
stage('Security Scan') {
    steps {
        sh 'vulnify test --severity high'
    }
}
```

## Troubleshooting

### Problemas Comuns

**Erro: "No dependency files found"**
- Certifique-se de estar no diretório correto do projeto
- Use `--file` para especificar um arquivo manualmente
- Verifique se o arquivo de dependências existe

**Erro: "Network Error"**
- Verifique sua conexão com a internet
- Confirme se a API está acessível
- Tente aumentar o timeout com `--timeout`

**Erro: "Rate Limit"**
- Use uma chave da API com `--api-key`
- Aguarde alguns minutos antes de tentar novamente

**Comando info não funciona**
- A API atual requer JSON em todas as requisições
- Este é um problema conhecido que será corrigido

### Debug

Para ativar logs de debug, use:
```bash
DEBUG=vulnify* vulnify test
```

## Desenvolvimento

### Scripts Disponíveis
```bash
npm run build      # Compila TypeScript
npm run dev        # Executa em modo desenvolvimento
npm run watch      # Observa mudanças e recompila
npm run clean      # Limpa arquivos compilados
```

### Estrutura do Projeto
```
src/
├── commands/      # Implementação dos comandos
├── services/      # Serviços (API, detector, parser, reporter)
├── types/         # Definições TypeScript
├── utils/         # Utilitários (config, colors, spinner, logger)
└── cli.ts         # Ponto de entrada principal
```

## Limitações Conhecidas

1. **Comando info**: A API atual sempre espera JSON, causando erro no endpoint GET /info
2. **Parsing limitado**: Alguns formatos complexos podem não ser totalmente suportados
3. **Cache**: Não implementado cache local (depende do cache da API)

## Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature
3. Commit suas mudanças
4. Push para a branch
5. Abra um Pull Request

## Licença

MIT License - veja o arquivo LICENSE para detalhes.

## Suporte

Para suporte e documentação adicional, visite: https://docs.vulnify.io

