# ⚡ Vulnify CLI

[![npm version](https://img.shields.io/npm/v/vulnify?color=blue&logo=npm)](https://www.npmjs.com/package/vulnify)
[![downloads](https://img.shields.io/npm/dw/vulnify?color=brightgreen)](https://www.npmjs.com/package/vulnify)
[![license](https://img.shields.io/badge/license-MIT-green)](./LICENSE)

> **🛡️ Atualização Importante:** A Vulnify CLI já detecta e alerta sobre o incidente de **supply chain attack** no pacote [chalk](https://github.com/chalk/chalk) (set/2025), incluindo a versão maliciosa **chalk@5.6.1**.  
> Isso garante que seus projetos estejam protegidos contra esse e outros ataques recentes na cadeia de suprimentos do npm.

---

## 🚀 Sobre

A **Vulnify CLI** é uma ferramenta de linha de comando para análise de vulnerabilidades em dependências de projetos. 
Ela se conecta ao **Vulnify SCA Backend** para identificar riscos de segurança em múltiplos ecossistemas, exibindo relatórios claros e acionáveis direto no terminal.

---

## 🔥 Updates Recentes

- ✅ **Suporte ao incidente chalk/debug (set/2025)**  
- 🚀 Melhoria de performance e cache inteligente  
- 🧩 Novos parsers para formatos de dependência (poetry, gradle.kts, etc.)  

---

## ✨ Características

- 🔍 **Detecção Automática** de arquivos de dependência  
- 🌐 **Múltiplos Ecossistemas**: npm, pypi, maven, nuget, rubygems, composer, go, cargo  
- 📊 **Relatórios Detalhados** em JSON e terminal  
- ⚡ **Performance** com cache otimizado  
- 🎨 **Interface Rica** com cores, tabelas e spinners  
- 🔧 **Configurável** via `.vulnifyrc` e variáveis de ambiente  

---

## 📦 Instalação

### Instalação Global
```bash
npm install -g vulnify
```

Após a instalação:
```bash
vulnify --version
vulnify help
vulnify test
```

### Instalação Local (Dev)
```bash
git clone https://github.com/vulnify/vulnify-cli.git
cd vulnify-cli
npm install
npm run build
node dist/cli.js --help
```

**Pré-requisitos**: Node.js >= 14.0.0

---

## 🛠️ Uso

### Comando principal
```bash
vulnify test
```

Exemplos:
```bash
# Analisar projeto atual
vulnify test

# Especificar arquivo
vulnify test --file package.json

# Forçar ecossistema
vulnify test --ecosystem npm

# Filtrar por severidade
vulnify test --severity high
```

---

## 📊 Ecossistemas Suportados

| Ecossistema | Arquivos Suportados | Exemplo |
|-------------|----------------------|---------|
| npm         | package.json, yarn.lock | `vulnify test --ecosystem npm` |
| pypi        | requirements.txt, pyproject.toml | `vulnify test --ecosystem pypi` |
| maven       | pom.xml, build.gradle | `vulnify test --ecosystem maven` |
| nuget       | *.csproj, packages.config | `vulnify test --ecosystem nuget` |
| rubygems    | Gemfile, Gemfile.lock | `vulnify test --ecosystem rubygems` |
| composer    | composer.json, composer.lock | `vulnify test --ecosystem composer` |
| go          | go.mod, go.sum | `vulnify test --ecosystem go` |
| cargo       | Cargo.toml, Cargo.lock | `vulnify test --ecosystem cargo` |

---

## ⚙️ Configuração

### Arquivo `.vulnifyrc`
```json
{
  "api_key": "sua-api-key",
  "severity_threshold": "medium",
  "output_format": "table"
}
```

### Variáveis de ambiente
```bash
export VULNIFY_API_KEY="sua-api-key"
export VULNIFY_API_URL="https://api.vulnify.io/api/v1"
```

---

## 🔒 Integração CI/CD

### GitHub Actions
```yaml
- name: Security Scan
  run: |
    npx vulnify-cli test --output json > report.json
    if [ $? -eq 1 ]; then exit 1; fi
```

### Jenkins
```groovy
stage('Security Scan') {
    steps {
        sh 'vulnify test --severity high'
    }
}
```

---

## 🤝 Contribuição

1. Fork o projeto  
2. Crie uma branch (`feature/minha-feature`)  
3. Commit suas alterações  
4. Push para a branch  
5. Abra um Pull Request  

---

## 📄 Licença

MIT License – veja [LICENSE](./LICENSE).  

📚 Documentação completa em: [docs.vulnify.io](https://docs.vulnify.io)  
