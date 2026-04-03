<?php

declare(strict_types=1);

final class SimplePdf
{
    public static function output(string $filename, string $title, array $lines): never
    {
        $contentLines = ['BT', '/F1 14 Tf', '40 800 Td', self::escape($title) . ' Tj'];
        $y = 780;

        foreach ($lines as $line) {
            $y -= 18;
            if ($y < 60) {
                break;
            }

            $contentLines[] = sprintf('1 0 0 1 40 %d Tm', $y);
            $contentLines[] = '/F1 10 Tf';
            $contentLines[] = self::escape($line) . ' Tj';
        }

        $contentLines[] = 'ET';
        $stream = implode("\n", $contentLines);
        $length = strlen($stream);

        $objects = [];
        $objects[] = '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj';
        $objects[] = '2 0 obj << /Type /Pages /Count 1 /Kids [3 0 R] >> endobj';
        $objects[] = '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj';
        $objects[] = '4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj';
        $objects[] = "5 0 obj << /Length {$length} >> stream\n{$stream}\nendstream endobj";

        $pdf = "%PDF-1.4\n";
        $offsets = [0];
        foreach ($objects as $object) {
            $offsets[] = strlen($pdf);
            $pdf .= $object . "\n";
        }

        $xref = strlen($pdf);
        $pdf .= 'xref' . "\n";
        $pdf .= '0 ' . (count($objects) + 1) . "\n";
        $pdf .= "0000000000 65535 f \n";

        foreach (array_slice($offsets, 1) as $offset) {
            $pdf .= sprintf("%010d 00000 n \n", $offset);
        }

        $pdf .= 'trailer << /Size ' . (count($objects) + 1) . ' /Root 1 0 R >>' . "\n";
        $pdf .= 'startxref' . "\n";
        $pdf .= $xref . "\n";
        $pdf .= '%%EOF';

        header('Content-Type: application/pdf');
        header('Content-Disposition: attachment; filename="' . $filename . '"');
        echo $pdf;
        exit;
    }

    private static function escape(string $value): string
    {
        $clean = iconv('UTF-8', 'Windows-1252//TRANSLIT//IGNORE', $value) ?: $value;
        $clean = str_replace(['\\', '(', ')'], ['\\\\', '\(', '\)'], $clean);
        return '(' . $clean . ')';
    }
}
