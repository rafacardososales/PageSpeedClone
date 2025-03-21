const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const { contrast } = require('color-contrast'); // Para verificação de contraste de cores

// Configurações
const REPORT_FILE = 'site-analysis-report.txt';
const MAX_IMAGE_SIZE_KB = 100; // Tamanho máximo de imagem permitido (em KB)
const SITE_URL = 'cheffycooking.netlify.app'; // Substitua pela URL do site

// Utilitários
function logError(message) {
    console.error(`❌ ${message}`);
}

function logSuccess(message) {
    console.log(`✅ ${message}`);
}

function formatSize(bytes) {
    return (bytes / 1024).toFixed(2) + ' KB';
}

// Função para obter a hierarquia de um elemento
function getElementHierarchy(element) {
    let hierarchy = [];
    let currentElement = element;

    while (currentElement && currentElement.tagName) {
        const tag = currentElement.tagName.toLowerCase();
        const id = currentElement.attribs.id ? `#${currentElement.attribs.id}` : '';
        const classes = currentElement.attribs.class ? `.${currentElement.attribs.class.split(' ').join('.')}` : '';
        hierarchy.unshift(`${tag}${id}${classes}`);
        currentElement = currentElement.parent;
    }

    return hierarchy.join(' > ');
}

// Módulo: SEO Analyzer
async function analyzeSEO($, htmlLines) {
    let report = [];

    // Verificar título da página
    const title = $('title').text();
    if (!title) {
        report.push({
            type: 'SEO',
            issue: 'Título ausente',
            solution: 'Adicione uma tag <title> no <head> do HTML.',
            location: 'Head do documento',
        });
    } else if (title.length > 60) {
        report.push({
            type: 'SEO',
            issue: 'Título muito longo',
            solution: 'Reduza o título para menos de 60 caracteres.',
            location: 'Head do documento',
        });
    }

    // Verificar meta description
    const description = $('meta[name="description"]').attr('content');
    if (!description) {
        report.push({
            type: 'SEO',
            issue: 'Meta description ausente',
            solution: 'Adicione uma meta description no <head> do HTML.',
            location: 'Head do documento',
        });
    } else if (description.length > 160) {
        report.push({
            type: 'SEO',
            issue: 'Meta description muito longa',
            solution: 'Reduza a meta description para menos de 160 caracteres.',
            location: 'Head do documento',
        });
    }

    // Verificar headings (h1, h2, h3, etc.)
    const headings = $('h1, h2, h3, h4, h5, h6');
    if (headings.length === 0) {
        report.push({
            type: 'SEO',
            issue: 'Nenhum heading encontrado',
            solution: 'Adicione headings (h1, h2, etc.) para estruturar o conteúdo.',
            location: 'Corpo do documento',
        });
    }

    return report;
}

// Módulo: Performance Analyzer
async function analyzePerformance($, htmlLines) {
    let report = [];

    // Verificar scripts bloqueantes
    $('script').each((index, script) => {
        const src = $(script).attr('src');
        const isAsync = $(script).attr('async') !== undefined;
        const isDefer = $(script).attr('defer') !== undefined;
        if (src && !isAsync && !isDefer) {
            const scriptTag = $.html(script);
            const lineIndex = htmlLines.findIndex(line => line.includes(scriptTag));
            report.push({
                type: 'Performance',
                issue: 'Script bloqueante',
                solution: 'Adicione os atributos "async" ou "defer" ao script.',
                location: `Linha ${lineIndex + 1}`,
                resource: src,
            });
        }
    });

    // Verificar imagens grandes
    $('img').each(async (index, img) => {
        const src = $(img).attr('src');
        if (src && !src.startsWith('data:')) {
            try {
                const response = await axios.head(src);
                const contentLength = response.headers['content-length'];
                if (contentLength && contentLength > MAX_IMAGE_SIZE_KB * 1024) {
                    const imgTag = $.html(img);
                    const lineIndex = htmlLines.findIndex(line => line.includes(imgTag));
                    report.push({
                        type: 'Performance',
                        issue: 'Imagem muito grande',
                        solution: `Reduza o tamanho da imagem para menos de ${MAX_IMAGE_SIZE_KB} KB.`,
                        location: `Linha ${lineIndex + 1}`,
                        resource: src,
                        size: formatSize(contentLength),
                    });
                }
            } catch (error) {
                logError(`Erro ao verificar imagem: ${src}`);
            }
        }
    });

    return report;
}

// Módulo: Accessibility Analyzer
async function analyzeAccessibility($, htmlLines) {
    let report = [];

    // Verificar imagens sem ALT
    $('img').each((index, img) => {
        const alt = $(img).attr('alt');
        if (!alt) {
            const imgTag = $.html(img);
            const lineIndex = htmlLines.findIndex(line => line.includes(imgTag));
            const hierarchy = getElementHierarchy(img);
            report.push({
                type: 'Acessibilidade',
                issue: 'Imagem sem atributo ALT',
                solution: 'Adicione um atributo "alt" descritivo à imagem.',
                location: `Linha ${lineIndex + 1}`,
                resource: $(img).attr('src'),
                hierarchy: hierarchy,
            });
        }
    });

    // Verificar contraste de cores
    $('*').each((index, element) => {
        const bgColor = $(element).css('background-color');
        const textColor = $(element).css('color');
        if (bgColor && textColor) {
            const contrastRatio = contrast(bgColor, textColor);
            if (contrastRatio < 4.5) {
                const elementTag = $.html(element);
                const lineIndex = htmlLines.findIndex(line => line.includes(elementTag));
                report.push({
                    type: 'Acessibilidade',
                    issue: 'Contraste de cores insuficiente',
                    solution: 'Aumente o contraste entre o texto e o fundo.',
                    location: `Linha ${lineIndex + 1}`,
                    resource: elementTag,
                    contrastRatio: contrastRatio.toFixed(2),
                });
            }
        }
    });

    return report;
}

// Módulo: Broken Links Checker
async function analyzeBrokenLinks($, htmlLines) {
    let report = [];

    // Verificar links quebrados
    $('a').each((index, link) => {
        const href = $(link).attr('href');
        if (href && (href.startsWith('#') || href === '')) {
            const linkTag = $.html(link);
            const lineIndex = htmlLines.findIndex(line => line.includes(linkTag));
            report.push({
                type: 'Link',
                issue: 'Link quebrado ou vazio',
                solution: 'Corrija ou remova o link.',
                location: `Linha ${lineIndex + 1}`,
                resource: href,
            });
        }
    });

    return report;
}

// Módulo: Security Analyzer
async function analyzeSecurity($, htmlLines) {
    let report = [];

    // Verificar uso de HTTPS
    const hasHttps = SITE_URL.startsWith('https://');
    if (!hasHttps) {
        report.push({
            type: 'Segurança',
            issue: 'Site não utiliza HTTPS',
            solution: 'Configure o site para usar HTTPS.',
            location: 'URL do site',
        });
    }

    return report;
}

// Módulo: Mobile Analyzer
async function analyzeMobile($, htmlLines) {
    let report = [];

    // Verificar viewport
    const viewport = $('meta[name="viewport"]').attr('content');
    if (!viewport) {
        report.push({
            type: 'Mobile',
            issue: 'Viewport não configurado',
            solution: 'Adicione uma meta tag viewport no <head> do HTML.',
            location: 'Head do documento',
        });
    }

    return report;
}

// Gerador de Relatório
function generateReport(report) {
    let reportText = '🔍 Relatório de Análise do Site\n\n';
    report.forEach((item, index) => {
        reportText += `📌 Problema ${index + 1}:\n`;
        reportText += `   - Tipo: ${item.type}\n`;
        reportText += `   - Problema: ${item.issue}\n`;
        reportText += `   - Solução: ${item.solution}\n`;
        reportText += `   - Localização: ${item.location}\n`;
        if (item.resource) reportText += `   - Recurso: ${item.resource}\n`;
        if (item.hierarchy) reportText += `   - Hierarquia: ${item.hierarchy}\n`;
        if (item.size) reportText += `   - Tamanho: ${item.size}\n`;
        if (item.contrastRatio) reportText += `   - Contraste: ${item.contrastRatio}\n`;
        reportText += '\n';
    });

    // Salvar relatório em arquivo
    fs.writeFileSync(REPORT_FILE, reportText);
    logSuccess(`Relatório salvo em ${REPORT_FILE}`);
}

// Função principal
async function analyzeSite(url) {
    try {
        const { data } = await axios.get(url);
        const $ = cheerio.load(data);
        const htmlLines = data.split('\n');

        // Executar módulos de análise
        const seoReport = await analyzeSEO($, htmlLines);
        const performanceReport = await analyzePerformance($, htmlLines);
        const accessibilityReport = await analyzeAccessibility($, htmlLines);
        const brokenLinksReport = await analyzeBrokenLinks($, htmlLines);
        const securityReport = await analyzeSecurity($, htmlLines);
        const mobileReport = await analyzeMobile($, htmlLines);

        // Consolidar relatório
        const fullReport = [
            ...seoReport,
            ...performanceReport,
            ...accessibilityReport,
            ...brokenLinksReport,
            ...securityReport,
            ...mobileReport,
        ];

        // Gerar relatório
        generateReport(fullReport);
    } catch (error) {
        logError(`Erro ao analisar o site: ${error.message}`);
    }
}

// Iniciar análise
analyzeSite(SITE_URL);