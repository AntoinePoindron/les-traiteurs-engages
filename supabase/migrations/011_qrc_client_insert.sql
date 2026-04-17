Côté client admin et collaborateur, lorsque je refuse un devis, rien ne change. La demande devrait passer au statut "Devis refusé"
Cette meme demande coté traiteur devrait également passer au statut "Devis refusé".

Côté client admin, développe la partie paramètres que tu renommes "paramètres structure". Dedans on doit pouvoir modifier les paramètres de sa structure.

Côté client admin, dans Equipe, Effectifs, le bouton modifier doit permettre de modifier les informations d'un collaborateur : Nom, Prénom, Poste.

Côté client admin, le bouton "Ajouter un collaborateur" affiche les mêmes champs qu'actuellement mais dans une modale.

Côté traiteur, retire le statut "Devis en attente" il ne correspond à rien.

----------

Développe le parcours d'inscription côté client. Le premier utilisateur à ajouter une structure lors de sont inscription est forcément admin de cette structure. Si quelqu'un d'autre cherche à s'inscrire à la même structure, l'admin devra d'abord valider son adhésion dans la partie Equipe -> Effectifs (notification)

Côté client admin, dans Equipe, il faut qu'un email soit envoyé à l'adresse qu'on rentre lorsqu'on ajoute un collaborateur. Cet email doit l'inviter à se créer un compte, il sera ensuite rattaché à cette structure. Tant que l'utilisateur n'a pas créé son compte, la ligne du collaborateur dans effectif est au statut "En attente de réponse"



