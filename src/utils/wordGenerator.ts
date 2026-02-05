import { Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType, HeadingLevel, ImageRun } from "docx";
import { saveAs } from "file-saver";
import { ReportData } from "../types/report";

export const generateWordDocument = async (data: ReportData, chartImageBase64?: string) => {
    const sections = [];

    // Title
    sections.push(
        new Paragraph({
            text: `商務旅行費用報告 (Business Travel Expense Report) - ${data.reportId}`,
            heading: HeadingLevel.HEADING_1,
            spacing: { after: 200 },
        })
    );

    // Header Info
    sections.push(
        new Paragraph({
            children: [
                new TextRun({ text: `用戶: ${data.user}   `, bold: true }),
                new TextRun({ text: `商機天數: ${data.summary.days}天   ` }),
                new TextRun({ text: `USD產率: ${data.summary.rateUSD}   ` }),
                new TextRun({ text: `期間: ${data.summary.period}` }),
            ],
            spacing: { after: 400 },
        })
    );

    // Summary Table (Total / Personal / Avg) - mimicking the cards roughly or just a table
    // Let's make a simple summary table
    const summaryTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
            new TableRow({
                children: [
                    new TableCell({ children: [new Paragraph("項目")] }),
                    new TableCell({ children: [new Paragraph("TWD")] }),
                    new TableCell({ children: [new Paragraph("USD")] }),
                ],
            }),
            new TableRow({
                children: [
                    new TableCell({ children: [new Paragraph("總支出 (Total)")] }),
                    new TableCell({ children: [new Paragraph(data.summary.totalTWD.toString())] }),
                    new TableCell({ children: [new Paragraph(data.summary.totalUSD.toString())] }),
                ],
            }),
            new TableRow({
                children: [
                    new TableCell({ children: [new Paragraph("個人負擔 (Personal)")] }),
                    new TableCell({ children: [new Paragraph(data.summary.personalTWD.toString())] }),
                    new TableCell({ children: [new Paragraph("-")] }),
                ],
            }),
            new TableRow({
                children: [
                    new TableCell({ children: [new Paragraph("日均支出 (Avg/Day)")] }),
                    new TableCell({ children: [new Paragraph(data.summary.avgDayTWD.toString())] }),
                    new TableCell({ children: [new Paragraph(data.summary.avgDayUSD.toString())] }),
                ],
            }),
        ],
    });
    sections.push(summaryTable);
    sections.push(new Paragraph({ text: "", spacing: { after: 400 } })); // Spacer

    // Chart Image
    if (chartImageBase64) {
        const response = await fetch(chartImageBase64);
        const blob = await response.blob();
        const arrayBuffer = await blob.arrayBuffer();

        sections.push(
            new Paragraph({
                children: [
                    new ImageRun({
                        data: arrayBuffer,
                        transformation: {
                            width: 500,
                            height: 300,
                        },
                    } as any),
                ],
                spacing: { after: 400 },
            })
        );
    }

    // Dynamic Detail Tables
    data.sections.forEach((section) => {
        sections.push(
            new Paragraph({
                text: section.title,
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 400, after: 200 },
            })
        );

        const headerRow = new TableRow({
            children: section.columns.map((col) =>
                new TableCell({
                    children: [new Paragraph({
                        children: [new TextRun({ text: col.header, bold: true })]
                    })],
                    shading: { fill: "E0E0E0" }
                })
            ),
        });

        const bodyRows = section.data.map((row) => {
            return new TableRow({
                children: section.columns.map((col) => {
                    let val = row[col.accessorKey];
                    // Simple formatting
                    if (col.type === 'currency' || col.type === 'number') {
                        val = val != null ? val.toLocaleString() : '';
                    }
                    return new TableCell({ children: [new Paragraph(String(val ?? ""))] });
                }),
            });
        });

        // Footer/Total Row
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const footerRow = new TableRow({
            children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Total", bold: true })] })], columnSpan: section.columns.length - 1 }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: section.total.displayString, bold: true })] })] })
            ]
        });

        const table = new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [headerRow, ...bodyRows, footerRow],
        });
        sections.push(table);

        sections.push(
            new Paragraph({
                text: `Total: ${section.total.displayString}`,
                alignment: "right",
                spacing: { before: 100, after: 200 }
            })
        );
    });


    const doc = new Document({
        sections: [
            {
                properties: {},
                children: sections,
            },
        ],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `Expense_Report_${data.reportId}.docx`);
};
