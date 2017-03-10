#!/bin/sh
bcftools query -f '%CHROM\t%POS\t%REF\t%ALT[\t%AD]\n' - | awk -F'\t' 'BEGIN{OFS=FS;ORS=FS} {gsub(/\./,"",$4);gsub(/\,/,"",$4); print($1,$2,$3 $4); for(i=5;i<=NF;i++) { print($i)}; printf("\n")}'