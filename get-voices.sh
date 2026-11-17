#!/data/data/com.termux/files/usr/bin/bash
# دانلود صداهای فارسی Piper داخل models/piper (قابل ازسرگیری). استفاده:
#   bash get-voices.sh reza_ibrahim ganji
# صداها: amir reza_ibrahim ganji ganji_adabi gyro magnoliasis  (هر کدام حدود ۶۰ مگابایت)
cd "$(dirname "$0")" && mkdir -p models/piper
B=https://huggingface.co/rhasspy/piper-voices/resolve/main/fa/fa_IR
[ $# -eq 0 ] && { echo "نام صدا را بدهید، مثلاً: bash get-voices.sh reza_ibrahim"; exit 1; }
for v in "$@"; do
  for ext in onnx.json onnx; do
    f=models/piper/fa_IR-$v-medium.$ext
    until curl -L --fail -C - -o "$f" "$B/$v/medium/fa_IR-$v-medium.$ext"; do echo "تلاش دوباره $f"; sleep 5; done
  done
done
ls -lh models/piper
