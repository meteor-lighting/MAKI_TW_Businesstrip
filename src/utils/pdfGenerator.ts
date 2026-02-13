import jsPDF from 'jspdf';
import { toPng } from 'html-to-image';

export const generatePDF = async (reportId: string) => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 10; // 10mm margin
    const contentWidth = pageWidth - (margin * 2);
    let yPos = margin;

    // Helper to add element to PDF
    const addElementToPdf = async (element: HTMLElement) => {
        try {
            // Options to ensure better quality and white background
            const dataUrl = await toPng(element, {
                quality: 0.95,
                backgroundColor: '#ffffff',
                // specific style overrides to ensure it looks good in PDF
                style: {
                    margin: '0',
                }
            });

            const imgProps = doc.getImageProperties(dataUrl);
            const imgHeight = (imgProps.height * contentWidth) / imgProps.width;

            // Check page break
            if (yPos + imgHeight > pageHeight - margin) {
                doc.addPage();
                yPos = margin;
            }

            doc.addImage(dataUrl, 'PNG', margin, yPos, contentWidth, imgHeight);
            yPos += imgHeight + 5; // 5mm gap between sections
        } catch (error) {
            console.error('Error generating PDF section:', error);
        }
    };

    // 1. Header
    const headerElement = document.getElementById('report-header-section');
    if (headerElement) await addElementToPdf(headerElement);

    // 2. Summary Section
    const summaryElement = document.getElementById('report-summary-section');
    if (summaryElement) await addElementToPdf(summaryElement);

    // 3. Charts Section
    const chartsElement = document.getElementById('report-charts-section');
    if (chartsElement) await addElementToPdf(chartsElement);

    // 4. Detail Tables
    const detailSections = document.querySelectorAll('.report-detail-section');
    for (let i = 0; i < detailSections.length; i++) {
        const section = detailSections[i] as HTMLElement;
        await addElementToPdf(section);
    }

    doc.save(`Expense_Report_${reportId}.pdf`);
};
