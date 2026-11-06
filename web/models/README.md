# Modèle d'émotions pour le prototype

Modèle ONNX hébergé : [kamaludeen/multilingual_go_emotions-ONNX](https://huggingface.co/kamaludeen/multilingual_go_emotions-ONNX), révision `521738dcb7ab13f3a6ab3a3cd8b1d0b90da3d3a4`.

Cette conversion correspond à la [V1 du modèle d'AnasAlokla](https://huggingface.co/AnasAlokla/multilingual_go_emotions), qui prend en charge le français et renvoie 28 scores d'émotion, dont `neutral`. Ce n'est pas la V1.2 exportée localement.

Le dépôt hébergé propose `onnx/model_quantized.onnx` (179 Mo) et `onnx/model_fp16.onnx` (356 Mo). Transformers.js peut charger le modèle depuis son identifiant Hugging Face. L'application ne le charge pas encore ; l'intégration devra choisir une seule variante et mesurer son comportement sur mobile.

Les exports locaux de V1.2 sont conservés dans `multilingual_go_emotions_V1.2/`. Ce dossier est exclu de Git, car GitHub refuse l'envoi de nouveaux objets LFS depuis ce fork public.
