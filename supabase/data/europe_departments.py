"""Departments of the best-known European universities (phase E1 rows), user request 2026-10-11.

The unit a student says they belong to (department / school / faculty, as the university names it), English names.
Years = undergraduate years of that unit's usual degree: England / Wales 3, integrated masters (MEng, MSci, MPhys,
MChem, MMath) and year-abroad language degrees 4; Scotland one more (4, integrated masters 5); Ireland 4; medicine
5–6, dentistry / veterinary 5 (the CHECK allows 1–6). Master's / PhD (8 / 9) are offered everywhere by the app.
A student whose unit is missing picks "I can't find my department". Run:
  python3 supabase/data/europe_departments.py > supabase/migrations/<ts>_europe_departments_<batch>.sql

Each university: (default years, lines "slug | Name | Short | years"); Short / years may be left empty.
"""

import re
import sys

UK_IE = {
    "oxford": (3, """
        classics | Classics | | 4
        english | English Language and Literature | English
        history | History | |
        art-history | History of Art | Art History
        linguistics | Linguistics, Philology and Phonetics | Linguistics
        languages | Medieval and Modern Languages | Modern Languages | 4
        music | Music | |
        asian | Asian and Middle Eastern Studies | Asian & Middle Eastern | 4
        philosophy | Philosophy | |
        theology | Theology and Religion | Theology
        ruskin | Ruskin School of Art | Fine Art
        chemistry | Chemistry | | 4
        cs | Computer Science | | 4
        earth | Earth Sciences | | 4
        engineering | Engineering Science | Engineering | 4
        materials | Materials | | 4
        maths | Mathematics | | 4
        physics | Physics | | 4
        statistics | Statistics | | 4
        biology | Biology | | 4
        biochem | Biochemistry | | 4
        medicine | Medicine | | 6
        biomed | Biomedical Sciences | Biomedical Sciences
        psychology | Experimental Psychology | Psychology
        archaeology | Archaeology | |
        anthropology | Anthropology and Museum Ethnography | Anthropology
        economics | Economics | |
        education | Education | |
        geography | Geography and the Environment | Geography
        law | Law | |
        politics | Politics and International Relations | Politics & IR
        said | Saïd Business School | Business
        blavatnik | Blavatnik School of Government | Government
        socialpolicy | Social Policy and Intervention | Social Policy
        sociology | Sociology | |
        internet | Oxford Internet Institute | Internet Institute
        intdev | International Development | Int. Development
    """),
    "cambridge": (3, """
        archaeology | Archaeology | |
        architecture | Architecture | |
        asian | Asian and Middle Eastern Studies | Asian & Middle Eastern | 4
        classics | Classics | |
        cs | Computer Science and Technology | Computer Science | 4
        economics | Economics | |
        education | Education | |
        engineering | Engineering | | 4
        chemeng | Chemical Engineering and Biotechnology | Chemical Engineering | 4
        english | English | |
        geography | Geography | |
        history | History | |
        art-history | History of Art | Art History
        hsps | Human, Social, and Political Science | HSPS
        landecon | Land Economy | |
        law | Law | |
        linguistics | Linguistics | |
        maths | Mathematics | | 4
        medicine | Medicine | | 6
        languages | Modern and Medieval Languages | Modern Languages | 4
        music | Music | |
        natsci | Natural Sciences | | 4
        philosophy | Philosophy | |
        psychology | Psychological and Behavioural Sciences | Psychology
        theology | Theology, Religion and Philosophy of Religion | Theology
        vet | Veterinary Medicine | | 6
        judge | Judge Business School | Business
    """),
    "imperial": (4, """
        aero | Aeronautics | |
        bioeng | Bioengineering | |
        chemeng | Chemical Engineering | |
        civil | Civil and Environmental Engineering | Civil Engineering
        computing | Computing | |
        design | Dyson School of Design Engineering | Design Engineering
        earth | Earth Science and Engineering | Earth Science
        eee | Electrical and Electronic Engineering | EEE
        materials | Materials | |
        mech | Mechanical Engineering | |
        chemistry | Chemistry | |
        maths | Mathematics | |
        physics | Physics | |
        life | Life Sciences | |
        medicine | Medicine | | 6
        business | Imperial Business School | Business | 3
    """),
    "ucl": (3, """
        anthropology | Anthropology | |
        archaeology | Institute of Archaeology | Archaeology
        bartlett | Bartlett School of Architecture | Architecture
        planning | Bartlett School of Planning | Planning
        construction | Bartlett School of Sustainable Construction | Construction
        biochemeng | Biochemical Engineering | | 4
        biosciences | Biosciences | |
        chemeng | Chemical Engineering | | 4
        chemistry | Chemistry | | 4
        civil | Civil, Environmental and Geomatic Engineering | Civil Engineering | 4
        cs | Computer Science | | 4
        earth | Earth Sciences | | 4
        economics | Economics | |
        eee | Electronic and Electrical Engineering | EEE | 4
        english | English Language and Literature | English
        selcs | European Languages, Culture and Society | SELCS | 4
        geography | Geography | |
        greeklatin | Greek and Latin | |
        hebrew | Hebrew and Jewish Studies | |
        history | History | |
        art-history | History of Art | Art History
        information | Information Studies | |
        ioe | IOE, Faculty of Education and Society | Education
        laws | Laws | |
        maths | Mathematics | | 4
        mech | Mechanical Engineering | | 4
        medphys | Medical Physics and Biomedical Engineering | Biomedical Engineering | 4
        medicine | Medical School | Medicine | 6
        management | School of Management | Management
        natsci | Natural Sciences | | 4
        pharmacy | School of Pharmacy | Pharmacy | 4
        philosophy | Philosophy | |
        physics | Physics and Astronomy | Physics | 4
        politics | Political Science | Politics
        psychology | Psychology and Language Sciences | Psychology
        slade | Slade School of Fine Art | Fine Art | 4
        ssees | School of Slavonic and East European Studies | SSEES | 4
        stats | Statistical Science | Statistics
        basc | Arts and Sciences (BASc) | Arts & Sciences | 4
    """),
    "kcl": (3, """
        classics | Classics | |
        complit | Comparative Literature | |
        digital | Digital Humanities | |
        english | English | |
        film | Film Studies | |
        languages | Languages, Literatures and Cultures | Languages | 4
        history | History | |
        music | Music | |
        philosophy | Philosophy | |
        theology | Theology and Religious Studies | Theology
        war | War Studies | |
        geography | Geography | |
        poleco | Political Economy | |
        eis | European and International Studies | European & Int. Studies | 4
        education | Education, Communication and Society | Education
        globalhealth | Global Health and Social Medicine | Global Health
        intdev | International Development | Int. Development
        cmci | Culture, Media and Creative Industries | Culture & Media
        business | King's Business School | Business
        law | Dickson Poon School of Law | Law
        dentistry | Dentistry | | 5
        medicine | GKT School of Medical Education | Medicine | 5
        biosciences | Life Sciences (Biosciences) | Biosciences
        pharmacy | Pharmacy | | 4
        nutrition | Nutritional Sciences | Nutrition
        nursing | Nursing and Midwifery | Nursing
        physio | Physiotherapy | |
        psychology | Psychology | |
        neuroscience | Neuroscience | |
        chemistry | Chemistry | | 4
        engineering | Engineering | | 4
        informatics | Informatics | Computer Science | 4
        maths | Mathematics | | 4
        physics | Physics | | 4
    """),
    "edinburgh": (4, """
        eca | Edinburgh College of Art | Art & Design
        architecture | Architecture and Landscape Architecture | Architecture | 5
        music | Music | |
        business | Business School | Business
        divinity | Divinity | |
        economics | Economics | |
        moray | Education and Sport (Moray House) | Education
        health | Health in Social Science | Health
        hca | History, Classics and Archaeology | History & Classics
        law | Law | |
        llc | Literatures, Languages and Cultures | Languages | 5
        ppls | Philosophy, Psychology and Language Sciences | PPLS
        sps | Social and Political Science | Social & Political Science
        medicine | Edinburgh Medical School | Medicine | 6
        biomed | Biomedical Sciences | |
        vet | Royal (Dick) School of Veterinary Studies | Veterinary | 5
        biology | Biological Sciences | Biology
        chemistry | Chemistry | | 5
        engineering | Engineering | | 5
        geosciences | GeoSciences | |
        informatics | Informatics | | 5
        maths | Mathematics | | 5
        physics | Physics and Astronomy | Physics | 5
    """),
    "manchester": (3, """
        biology | Biological Sciences | Biology
        medicine | Medicine | | 5
        dentistry | Dentistry | | 5
        pharmacy | Pharmacy | | 4
        nursing | Nursing, Midwifery and Social Work | Nursing
        psychology | Psychology | |
        chemeng | Chemical Engineering | | 4
        cs | Computer Science | | 4
        eee | Electrical and Electronic Engineering | EEE | 4
        mace | Mechanical, Aerospace and Civil Engineering | MACE | 4
        chemistry | Chemistry | | 4
        earth | Earth and Environmental Sciences | Earth Sciences | 4
        physics | Physics and Astronomy | Physics | 4
        materials | Materials | | 4
        maths | Mathematics | | 4
        archaeology | Archaeology | |
        art-history | Art History and Visual Studies | Art History
        classics | Classics and Ancient History | Classics
        drama | Drama | |
        english | English and American Studies | English
        history | History | |
        linguistics | Linguistics and English Language | Linguistics
        languages | Modern Languages and Cultures | Modern Languages | 4
        music | Music | |
        religions | Religions and Theology | Theology
        geography | Geography | |
        planning | Planning and Environmental Management | Planning
        architecture | Manchester School of Architecture | Architecture
        education | Education | |
        law | Law | |
        criminology | Criminology | |
        economics | Economics | |
        politics | Politics | |
        sociology | Sociology | |
        philosophy | Philosophy | |
        anthropology | Social Anthropology | Anthropology
        business | Alliance Manchester Business School | Business
    """),
    "bristol": (3, """
        anthropology | Anthropology and Archaeology | Anthropology & Archaeology
        classics | Classics and Ancient History | Classics
        english | English | |
        film | Film and Television | Film & TV
        history | History | |
        art-history | History of Art | Art History
        languages | Modern Languages | | 4
        music | Music | |
        philosophy | Philosophy | |
        theology | Religion and Theology | Theology
        theatre | Theatre | |
        aero | Aerospace Engineering | | 4
        civil | Civil Engineering | | 4
        cs | Computer Science | | 4
        eee | Electrical and Electronic Engineering | EEE | 4
        engmaths | Engineering Mathematics | | 4
        mech | Mechanical Engineering | | 4
        medicine | Medicine | | 5
        dentistry | Dentistry | | 5
        vet | Veterinary Science | | 5
        biochem | Biochemistry | |
        biology | Biological Sciences | Biology
        cmm | Cellular and Molecular Medicine | Cellular & Molecular Medicine
        ppn | Physiology, Pharmacology and Neuroscience | Physiology & Neuroscience
        psychology | Psychological Science | Psychology
        chemistry | Chemistry | | 4
        earth | Earth Sciences | | 4
        geography | Geographical Sciences | Geography
        maths | Mathematics | | 4
        physics | Physics | | 4
        business | Business School | Business
        economics | Economics | |
        education | Education | |
        law | Law | |
        policy | Policy Studies | |
        spais | Sociology, Politics and International Studies | SPAIS
    """),
    "warwick": (3, """
        chemistry | Chemistry | | 4
        cs | Computer Science | | 4
        engineering | Engineering | | 4
        life | Life Sciences | |
        maths | Mathematics | | 4
        physics | Physics | | 4
        statistics | Statistics | | 4
        psychology | Psychology | |
        medicine | Warwick Medical School | Medicine | 4
        economics | Economics | |
        law | Law | |
        pais | Politics and International Studies | Politics & IR
        philosophy | Philosophy | |
        sociology | Sociology | |
        education | Education Studies | Education
        wbs | Warwick Business School | Business
        english | English and Comparative Literary Studies | English
        history | History | |
        art-history | History of Art | Art History
        classics | Classics and Ancient History | Classics
        film | Film and Television Studies | Film & TV
        theatre | Theatre and Performance Studies | Theatre
        languages | Modern Languages and Cultures | Modern Languages | 4
        liberal | Liberal Arts | |
        gsd | Global Sustainable Development | Sustainable Development
    """),
    "glasgow": (4, """
        critical | Critical Studies (English, Scottish Literature) | English & Literature
        ccpa | Culture and Creative Arts | Creative Arts
        humanities | Humanities (History, Classics, Archaeology, Philosophy, Theology) | Humanities
        languages | Modern Languages and Cultures | Modern Languages | 5
        medicine | Medicine | | 5
        dentistry | Dentistry | | 5
        vet | Veterinary Medicine | | 5
        biosciences | Molecular Biosciences | Biosciences
        life | Life Sciences | |
        psychology | Psychology and Neuroscience | Psychology
        chemistry | Chemistry | | 5
        computing | Computing Science | | 5
        engineering | Engineering | | 5
        ges | Geographical and Earth Sciences | Geography & Earth Sciences
        maths | Mathematics and Statistics | Mathematics | 5
        physics | Physics and Astronomy | Physics | 5
        business | Adam Smith Business School | Business
        education | Education | |
        law | Law | |
        sps | Social and Political Sciences | Social & Political Sciences
        dumfries | Interdisciplinary Studies (Dumfries) | Dumfries
    """),
    "durham": (3, """
        anthropology | Anthropology | |
        archaeology | Archaeology | |
        biosciences | Biosciences | |
        business | Business School | Business
        chemistry | Chemistry | | 4
        classics | Classics and Ancient History | Classics
        cs | Computer Science | | 4
        earth | Earth Sciences | | 4
        economics | Economics and Finance | Economics
        education | Education | |
        engineering | Engineering | | 4
        english | English Studies | English
        geography | Geography | |
        sgia | Government and International Affairs | Government & IR
        history | History | |
        law | Law | |
        maths | Mathematical Sciences | Mathematics | 4
        languages | Modern Languages and Cultures | Modern Languages | 4
        music | Music | |
        natsci | Natural Sciences | | 4
        philosophy | Philosophy | |
        physics | Physics | | 4
        psychology | Psychology | |
        sociology | Sociology | |
        sport | Sport and Exercise Sciences | Sport
        theology | Theology and Religion | Theology
    """),
    "standrews": (4, """
        art-history | Art History | |
        biology | Biology | |
        chemistry | Chemistry | | 5
        classics | Classics | |
        cs | Computer Science | | 5
        divinity | Divinity | |
        earth | Earth and Environmental Sciences | Earth Sciences
        economics | Economics and Finance | Economics
        english | English | |
        film | Film Studies | |
        geography | Geography and Sustainable Development | Geography
        history | History | |
        ir | International Relations | |
        management | Management | |
        maths | Mathematics and Statistics | Mathematics | 5
        medicine | Medicine | | 3
        languages | Modern Languages | | 5
        philosophy | Philosophy | |
        physics | Physics and Astronomy | Physics | 5
        psychology | Psychology and Neuroscience | Psychology
        anthropology | Social Anthropology | Anthropology
    """),
    "southampton": (3, """
        aero | Aeronautics and Astronautics | Aeronautics | 4
        civil | Civil, Maritime and Environmental Engineering | Civil Engineering | 4
        ecs | Electronics and Computer Science | ECS | 4
        mech | Mechanical Engineering | | 4
        chemistry | Chemistry | | 4
        maths | Mathematical Sciences | Mathematics | 4
        physics | Physics and Astronomy | Physics | 4
        ocean | Ocean and Earth Science | Ocean & Earth | 4
        biology | Biological Sciences | Biology
        medicine | Medicine | | 5
        health | Health Sciences | |
        psychology | Psychology | |
        geography | Geography and Environmental Science | Geography
        business | Southampton Business School | Business
        economics | Economics | |
        law | Law | |
        politics | Politics and International Relations | Politics & IR
        sociology | Sociology, Social Policy and Criminology | Sociology
        education | Education | |
        art | Winchester School of Art | Art & Design
        english | English | |
        history | History | |
        archaeology | Archaeology | |
        film | Film | |
        languages | Modern Languages and Linguistics | Modern Languages | 4
        music | Music | |
        philosophy | Philosophy | |
    """),
    "leeds": (3, """
        biology | Biology | |
        biomed | Biomedical Sciences | |
        chemistry | Chemistry | | 4
        civil | Civil Engineering | | 4
        chemeng | Chemical and Process Engineering | Chemical Engineering | 4
        computing | Computing | | 4
        eee | Electronic and Electrical Engineering | EEE | 4
        mech | Mechanical Engineering | | 4
        maths | Mathematics | | 4
        physics | Physics and Astronomy | Physics | 4
        earth | Earth and Environment | |
        food | Food Science and Nutrition | Food Science
        geography | Geography | |
        psychology | Psychology | |
        medicine | Medicine | | 5
        dentistry | Dentistry | | 5
        healthcare | Healthcare (Nursing, Midwifery) | Healthcare
        business | Leeds University Business School | Business
        economics | Economics | |
        law | Law | |
        politics | Politics and International Studies | Politics & IR
        sociology | Sociology and Social Policy | Sociology
        education | Education | |
        media | Media and Communication | Media
        english | English | |
        history | History | |
        prhs | Philosophy, Religion and History of Science | Philosophy
        fine-art | Fine Art, History of Art and Cultural Studies | Fine Art & Art History
        design | Design | |
        languages | Languages, Cultures and Societies | Languages | 4
        music | Music | |
        pci | Performance and Cultural Industries | Performance
    """),
    "birmingham": (3, """
        biosciences | Biosciences | |
        chemistry | Chemistry | | 4
        chemeng | Chemical Engineering | | 4
        civil | Civil Engineering | | 4
        cs | Computer Science | | 4
        eese | Electronic, Electrical and Systems Engineering | EEE | 4
        mech | Mechanical Engineering | | 4
        materials | Metallurgy and Materials | Materials | 4
        maths | Mathematics | | 4
        physics | Physics and Astronomy | Physics | 4
        gees | Geography, Earth and Environmental Sciences | Geography & Earth Sciences
        psychology | Psychology | |
        sport | Sport, Exercise and Rehabilitation Sciences | Sport
        medicine | Medicine | | 5
        dentistry | Dentistry | | 5
        pharmacy | Pharmacy | | 4
        nursing | Nursing | |
        business | Birmingham Business School | Business
        economics | Economics | |
        law | Birmingham Law School | Law
        government | Government (Politics and International Relations) | Politics & IR
        socialpolicy | Social Policy, Sociology and Criminology | Social Policy
        education | Education | |
        english | English, Drama and Creative Studies | English & Drama
        history | History and Cultures | History
        ptr | Philosophy, Theology and Religion | Philosophy & Theology
        lcahm | Languages, Cultures, Art History and Music | Languages & Arts | 4
    """),
    "sheffield": (3, """
        architecture | Architecture | |
        planning | Urban Studies and Planning | Planning
        biosciences | Biosciences | |
        chemistry | Chemistry | | 4
        chemeng | Chemical, Materials and Biological Engineering | Chemical Engineering | 4
        cs | Computer Science | | 4
        eee | Electrical and Electronic Engineering | EEE | 4
        mac | Mechanical, Aerospace and Civil Engineering | Mech., Aero & Civil Eng. | 4
        maths | Mathematics and Statistics | Mathematics | 4
        physics | Physics and Astronomy | Physics | 4
        geography | Geography | |
        psychology | Psychology | |
        medicine | Medicine | | 5
        dentistry | Dentistry | | 5
        health | Health Sciences | |
        management | Sheffield University Management School | Management
        economics | Economics | |
        law | Law | |
        politics | Politics and International Relations | Politics & IR
        sociology | Sociological Studies | Sociology
        education | Education | |
        journalism | Journalism Studies | Journalism
        information | Information School | Information
        english | English | |
        history | History | |
        philosophy | Philosophy | |
        languages | Languages and Cultures | Languages | 4
        music | Music | |
        archaeology | Archaeology | |
        eas | East Asian Studies | East Asian Studies | 4
    """),
    "nottingham": (3, """
        biosciences | Biosciences | |
        chemistry | Chemistry | | 4
        chemeng | Chemical and Environmental Engineering | Chemical Engineering | 4
        civil | Civil Engineering | | 4
        cs | Computer Science | | 4
        eee | Electrical and Electronic Engineering | EEE | 4
        m3 | Mechanical, Materials and Manufacturing Engineering | Mechanical Engineering | 4
        architecture | Architecture and Built Environment | Architecture
        maths | Mathematical Sciences | Mathematics | 4
        physics | Physics and Astronomy | Physics | 4
        pharmacy | Pharmacy | | 4
        life | Life Sciences | |
        medicine | Medicine | | 5
        vet | Veterinary Medicine and Science | Veterinary | 5
        health | Health Sciences | |
        psychology | Psychology | |
        business | Nottingham University Business School | Business
        economics | Economics | |
        law | Law | |
        politics | Politics and International Relations | Politics & IR
        sociology | Sociology and Social Policy | Sociology
        education | Education | |
        geography | Geography | |
        english | English | |
        history | History | |
        classics | Classics and Archaeology | Classics
        philosophy | Philosophy | |
        music | Music | |
        theology | Theology and Religious Studies | Theology
        languages | Cultures, Languages and Area Studies | Languages | 4
    """),
    "qmul": (3, """
        sbbs | Biological and Behavioural Sciences | Biology & Psychology
        spcs | Physical and Chemical Sciences | Physics & Chemistry | 4
        eecs | Electronic Engineering and Computer Science | EECS | 4
        sems | Engineering and Materials Science | Engineering | 4
        maths | Mathematical Sciences | Mathematics | 4
        geography | Geography | |
        medicine | Barts and The London School of Medicine | Medicine | 5
        dentistry | Dentistry | | 5
        business | Business and Management | Business
        economics | Economics and Finance | Economics
        law | Law | |
        politics | Politics and International Relations | Politics & IR
        english | English and Drama | English & Drama
        history | History | |
        sllf | Languages, Linguistics and Film | Languages & Film | 4
    """),
    "bath": (4, """
        ace | Architecture and Civil Engineering | Architecture & Civil Eng.
        chemeng | Chemical Engineering | |
        eee | Electronic and Electrical Engineering | EEE
        mech | Mechanical Engineering | |
        biology | Life Sciences (Biology and Biochemistry) | Biology
        chemistry | Chemistry | |
        cs | Computer Science | |
        maths | Mathematical Sciences | Mathematics
        natsci | Natural Sciences | |
        physics | Physics | |
        pharmacy | Pharmacy and Pharmacology | Pharmacy
        psychology | Psychology | |
        health | Health (Sport and Exercise Science) | Sport & Health
        management | School of Management | Management
        economics | Economics | |
        polis | Politics, Languages and International Studies | Politics & Languages
        sps | Social and Policy Sciences | Social Sciences
        education | Education | |
    """),
    "exeter": (3, """
        business | University of Exeter Business School | Business
        economics | Economics | |
        law | Law | |
        politics | Politics and International Relations | Politics & IR
        spa | Sociology, Philosophy and Anthropology | Sociology & Philosophy
        archaeology | Archaeology and History | History & Archaeology
        classics | Classics, Ancient History, Religion and Theology | Classics & Theology
        english | English and Film | English & Film
        languages | Modern Languages and Cultures | Modern Languages | 4
        arabic | Arab and Islamic Studies | Arab & Islamic Studies | 4
        drama | Drama | |
        psychology | Psychology | |
        sport | Sport and Health Sciences | Sport
        medicine | Medicine | | 5
        biosciences | Biosciences | |
        geography | Geography | |
        csm | Camborne School of Mines (Earth and Environmental Sciences) | Earth Sciences
        engineering | Engineering | | 4
        cs | Computer Science | | 4
        maths | Mathematics | | 4
        natsci | Natural Sciences | | 4
        physics | Physics and Astronomy | Physics | 4
        education | Education | |
    """),
    "york": (3, """
        archaeology | Archaeology | |
        biology | Biology | |
        chemistry | Chemistry | | 4
        cs | Computer Science | | 4
        economics | Economics and Related Studies | Economics
        education | Education | |
        engineering | Physics, Engineering and Technology | Engineering | 4
        english | English and Related Literature | English
        environment | Environment and Geography | Geography
        health | Health Sciences | |
        history | History | |
        art-history | History of Art | Art History
        language | Language and Linguistic Science | Linguistics
        law | Law | |
        management | Management | |
        maths | Mathematics | | 4
        medicine | Hull York Medical School | Medicine | 5
        music | Music | |
        philosophy | Philosophy | |
        physics | Physics | | 4
        politics | Politics | |
        psychology | Psychology | |
        socialpolicy | Social Policy and Social Work | Social Policy
        sociology | Sociology | |
        tfti | Arts and Creative Technologies (Theatre, Film, Television) | Theatre, Film & TV
    """),
    "lancaster": (3, """
        management | Management School | Management
        economics | Economics | |
        law | Law | |
        ppr | Politics, Philosophy and Religion | Politics & Philosophy
        sociology | Sociology | |
        linguistics | Linguistics and English Language | Linguistics
        english | English Literature and Creative Writing | English
        history | History | |
        languages | Languages and Cultures | Languages | 4
        lica | Contemporary Arts (Art, Design, Film, Music, Theatre) | Arts
        psychology | Psychology | |
        education | Educational Research | Education
        biomed | Biomedical and Life Sciences | Life Sciences
        medicine | Medicine | | 5
        health | Health and Medicine | Health
        chemistry | Chemistry | | 4
        computing | Computing and Communications | Computing | 4
        engineering | Engineering | | 4
        maths | Mathematics and Statistics | Mathematics | 4
        physics | Physics | | 4
        lec | Lancaster Environment Centre | Environment
    """),
    "cityuol": (3, """
        bayes | Bayes Business School | Business
        law | The City Law School | Law
        economics | Economics | |
        politics | International Politics | Politics & IR
        sociology | Sociology and Criminology | Sociology
        journalism | Journalism | |
        music | Music | |
        psychology | Psychology | |
        nursing | Nursing and Midwifery | Nursing
        optometry | Optometry | |
        cs | Computer Science | |
        engineering | Engineering | | 4
        maths | Mathematics | |
        medicine | Medicine (St George's) | Medicine | 5
        biomed | Biomedical Science | |
        healthcare | Healthcare Sciences (Physiotherapy, Paramedic Science) | Healthcare Sciences
    """),
    "strathclyde": (4, """
        business | Strathclyde Business School | Business
        economics | Economics | |
        law | Law | |
        humanities | Humanities (English, History, Journalism) | Humanities
        languages | Modern Languages | | 5
        government | Government and Public Policy | Government
        psychology | Psychological Sciences and Health | Psychology
        socialwork | Social Work and Social Policy | Social Work
        education | Education | |
        architecture | Architecture | |
        biomedeng | Biomedical Engineering | | 5
        chemeng | Chemical and Process Engineering | Chemical Engineering | 5
        civil | Civil and Environmental Engineering | Civil Engineering | 5
        dmem | Design, Manufacture and Engineering Management | Design & Manufacture | 5
        eee | Electronic and Electrical Engineering | EEE | 5
        mech | Mechanical and Aerospace Engineering | Mechanical Engineering | 5
        naval | Naval Architecture, Ocean and Marine Engineering | Naval Architecture | 5
        cis | Computer and Information Sciences | Computer Science
        maths | Mathematics and Statistics | Mathematics
        physics | Physics | | 5
        chemistry | Pure and Applied Chemistry | Chemistry | 5
        sipbs | Pharmacy and Biomedical Sciences | Pharmacy | 5
    """),
    "tcd": (4, """
        business | Trinity Business School | Business
        law | Law | |
        economics | Economics | |
        politics | Political Science | Politics
        sociology | Sociology | |
        philosophy | Philosophy | |
        pps | Philosophy, Political Science, Economics and Sociology (PPES) | PPES
        psychology | Psychology | |
        education | Education | |
        socialwork | Social Work and Social Policy | Social Work
        english | English | |
        histories | Histories and Humanities (History, Classics) | History & Classics
        languages | Languages, Literatures and Cultural Studies | Languages
        slscs | Linguistic, Speech and Communication Sciences | Linguistics
        creative | Creative Arts (Drama, Film, Music) | Creative Arts
        religion | Religion, Theology and Peace Studies | Theology
        engineering | Engineering | | 5
        cs | Computer Science and Statistics | Computer Science | 5
        maths | Mathematics | |
        physics | Physics | |
        chemistry | Chemistry | |
        natsci | Natural Sciences | |
        biochem | Biochemistry and Immunology | Biochemistry
        genetics | Genetics and Microbiology | Genetics
        medicine | Medicine | | 6
        dental | Dental Science | Dentistry | 5
        pharmacy | Pharmacy and Pharmaceutical Sciences | Pharmacy | 5
        nursing | Nursing and Midwifery | Nursing
    """),
    "ucd": (4, """
        agriculture | Agriculture and Food Science | Agriculture
        architecture | Architecture, Planning and Environmental Policy | Architecture | 5
        art-history | Art History and Cultural Policy | Art History
        biology | Biology and Environmental Science | Biology
        biomed | Biomolecular and Biomedical Science | Biomedical Science
        biosystems | Biosystems and Food Engineering | Biosystems Engineering | 5
        chemeng | Chemical and Bioprocess Engineering | Chemical Engineering | 5
        chemistry | Chemistry | |
        civil | Civil Engineering | | 5
        classics | Classics | |
        cs | Computer Science | |
        economics | Economics | |
        education | Education | |
        eee | Electrical and Electronic Engineering | EEE | 5
        english | English, Drama and Film | English
        geography | Geography | |
        history | History | |
        information | Information and Communication Studies | Information Studies
        irish | Irish, Celtic Studies and Folklore | Irish Studies
        languages | Languages, Cultures and Linguistics | Languages
        law | Sutherland School of Law | Law
        maths | Mathematics and Statistics | Mathematics
        mech | Mechanical and Materials Engineering | Mechanical Engineering | 5
        medicine | Medicine | | 6
        music | Music | |
        nursing | Nursing, Midwifery and Health Systems | Nursing
        philosophy | Philosophy | |
        physics | Physics | |
        politics | Politics and International Relations | Politics & IR
        psychology | Psychology | |
        public-health | Public Health, Physiotherapy and Sports Science | Public Health & Sport
        socialpolicy | Social Policy, Social Work and Social Justice | Social Policy
        sociology | Sociology | |
        vet | Veterinary Medicine | | 5
        business | Quinn School of Business | Business
    """),
}

# Switzerland, Germany, Austria, Netherlands, Belgium, Luxembourg: bachelor 3 years; medicine 6, dentistry / veterinary
# 5 (Netherlands / Belgium veterinary 6), German law (state exam) 5, Austrian law (Diplom) 4, German pharmacy 4.
CENTRAL = {
    "ethz": (3, """
        arch | Architecture | |
        baug | Civil, Environmental and Geomatic Engineering | Civil Engineering
        mavt | Mechanical and Process Engineering | Mechanical Engineering
        itet | Information Technology and Electrical Engineering | Electrical Engineering
        infk | Computer Science | |
        matl | Materials | |
        bsse | Biosystems Science and Engineering | Biosystems
        math | Mathematics | |
        phys | Physics | |
        chab | Chemistry and Applied Biosciences | Chemistry
        biol | Biology | |
        erdw | Earth and Planetary Sciences | Earth Sciences
        usys | Environmental Systems Science | Environmental Sciences
        hest | Health Sciences and Technology | Health Sciences
        mtec | Management, Technology and Economics | Management
        gess | Humanities, Social and Political Sciences | Humanities & Politics
        medicine | Human Medicine | Medicine | 3
    """),
    "epfl": (3, """
        architecture | Architecture | |
        civil | Civil Engineering | |
        environmental | Environmental Sciences and Engineering | Environmental Engineering
        cs | Computer Science | |
        sc | Communication Systems | |
        maths | Mathematics | |
        physics | Physics | |
        chemistry | Chemistry and Chemical Engineering | Chemistry
        mech | Mechanical Engineering | |
        ee | Electrical and Electronic Engineering | Electrical Engineering
        materials | Materials Science and Engineering | Materials
        micro | Microengineering | |
        life | Life Sciences Engineering | Life Sciences
        cdm | Management of Technology | Management
    """),
    "uzh": (3, """
        theology | Theology and the Study of Religion | Theology
        law | Law | |
        business | Business, Economics and Informatics | Business & Economics
        informatics | Informatics | |
        medicine | Medicine | | 6
        vetsuisse | Vetsuisse (Veterinary Medicine) | Veterinary | 5
        arts | Arts and Social Sciences | Arts & Social Sciences
        psychology | Psychology | |
        science | Science | |
    """),
    "unige": (3, """
        science | Science | |
        medicine | Medicine | | 6
        humanities | Humanities | |
        gsem | Geneva School of Economics and Management | Economics & Management
        sds | Social Sciences | |
        law | Law | |
        theology | Theology | |
        fapse | Psychology and Educational Sciences | Psychology & Education
        fti | Translation and Interpreting | Translation
        gsi | Global Studies Institute | Global Studies
    """),
    "unibe": (3, """
        theology | Theology | |
        law | Law | |
        wiso | Business, Economics and Social Sciences | Business & Economics
        medicine | Medicine | | 6
        vetsuisse | Vetsuisse (Veterinary Medicine) | Veterinary | 5
        humanities | Humanities | |
        human | Human Sciences (Psychology, Education, Sport) | Human Sciences
        science | Science | |
    """),
    "unil": (3, """
        theology | Theology and Religious Studies | Theology
        law | Law, Criminal Justice and Public Administration | Law
        lettres | Arts | |
        ssp | Social and Political Sciences | Social & Political Sciences
        hec | HEC Lausanne (Business and Economics) | Business & Economics
        gse | Geosciences and Environment | Geosciences
        biology | Biology | |
        medicine | Medicine | | 6
    """),
    "unibas": (3, """
        theology | Theology | |
        law | Law | |
        medicine | Medicine | | 6
        humanities | Humanities and Social Sciences | Humanities
        science | Science | |
        business | Business and Economics | Business & Economics
        psychology | Psychology | |
    """),
    "unisg": (3, """
        bwl | Business Administration | |
        economics | Economics | |
        ia | International Affairs | |
        law | Law | |
        lawecon | Law and Economics | |
        cs | Computer Science | |
    """),
    "tum": (3, """
        informatics | Informatics | |
        maths | Mathematics | |
        ece | Electrical and Computer Engineering | Electrical Engineering
        mech | Mechanical Engineering | |
        aero | Aerospace and Geodesy | Aerospace
        civil | Civil and Environmental Engineering | Civil Engineering
        architecture | Architecture | |
        physics | Physics | |
        chemistry | Chemistry | |
        biosciences | Biosciences | |
        life | Life Sciences (Weihenstephan) | Life Sciences
        medicine | Medicine | | 6
        sport | Sport and Health Sciences | Sport
        management | TUM School of Management | Management
        education | Educational Sciences | Education
        hfp | Political Science (Hochschule für Politik) | Political Science
        straubing | Campus Straubing | Straubing
    """),
    "lmu": (3, """
        cath | Catholic Theology | |
        prot | Protestant Theology | |
        law | Law | | 5
        business | Munich School of Management | Management
        economics | Economics | |
        medicine | Medicine | | 6
        vet | Veterinary Medicine | | 5
        history | History and the Arts | History & Arts
        philosophy | Philosophy, Philosophy of Science and Study of Religion | Philosophy
        psychology | Psychology and Educational Sciences | Psychology & Education
        cultural | Cultural Studies | |
        languages | Languages and Literatures | Languages
        social | Social Sciences | |
        mathinf | Mathematics, Informatics and Statistics | Maths & Informatics
        physics | Physics | |
        chemistry | Chemistry | |
        pharmacy | Pharmacy | | 4
        biology | Biology | |
        geosciences | Geosciences | |
    """),
    "heidelberg": (3, """
        theology | Theology | |
        law | Law | | 5
        medicine | Medicine (Heidelberg) | Medicine | 6
        medma | Medicine (Mannheim) | Medicine Mannheim | 6
        philosophy | Philosophy (History, Philosophy, Arts) | Philosophy & History
        languages | Modern Languages | |
        economics | Economics and Social Sciences | Economics & Social Sciences
        behavioural | Behavioural and Cultural Studies | Psychology & Cultural Studies
        mathinf | Mathematics and Computer Science | Maths & Computer Science
        chemistry | Chemistry and Earth Sciences | Chemistry
        biosciences | Biosciences | |
        physics | Physics and Astronomy | Physics
        engineering | Engineering Sciences | Engineering
    """),
    "fuberlin": (3, """
        biology | Biology | |
        chemistry | Chemistry | |
        pharmacy | Pharmacy | | 4
        earth | Earth Sciences | |
        history | History and Cultural Studies | History
        mathinf | Mathematics and Computer Science | Maths & Computer Science
        philosophy | Philosophy and Humanities | Philosophy & Humanities
        physics | Physics | |
        polsoz | Political and Social Sciences | Political Science
        education | Education and Psychology | Education & Psychology
        law | Law | | 5
        business | School of Business and Economics | Business & Economics
        vet | Veterinary Medicine | | 5
        medicine | Medicine (Charité) | Medicine | 6
    """),
    "huberlin": (3, """
        law | Law | | 5
        life | Life Sciences | |
        maths | Mathematics | |
        cs | Computer Science | |
        physics | Physics | |
        chemistry | Chemistry | |
        geography | Geography | |
        psychology | Psychology | |
        philfak | Humanities (History, Philosophy, Classics) | Humanities
        language | Language, Literature and Humanities | Languages & Literature
        ksb | Humanities and Social Sciences | Social Sciences
        theology | Theology | |
        business | School of Business and Economics | Business & Economics
        medicine | Medicine (Charité) | Medicine | 6
    """),
    "tuberlin": (3, """
        humanities | Humanities | |
        science | Mathematics and Natural Sciences | Maths & Sciences
        process | Process Sciences | |
        eecs | Electrical Engineering and Computer Science | EE & Computer Science
        mech | Mechanical Engineering and Transport Systems | Mechanical Engineering
        planning | Planning, Building, Environment | Architecture & Planning
        economics | Economics and Management | Economics & Management
    """),
    "rwth": (3, """
        maths | Mathematics | |
        cs | Computer Science | |
        physics | Physics | |
        chemistry | Chemistry | |
        biology | Biology | |
        architecture | Architecture | |
        civil | Civil Engineering | |
        mech | Mechanical Engineering | |
        georesources | Georesources and Materials Engineering | Materials & Georesources
        eei | Electrical Engineering and Information Technology | Electrical Engineering
        arts | Arts and Humanities | |
        business | School of Business and Economics | Business & Economics
        medicine | Medicine | | 6
    """),
    "kit": (3, """
        maths | Mathematics | |
        physics | Physics | |
        chembio | Chemistry and Biosciences | Chemistry & Biosciences
        architecture | Architecture | |
        civil | Civil Engineering, Geo and Environmental Sciences | Civil Engineering
        mech | Mechanical Engineering | |
        ciw | Chemical and Process Engineering | Chemical Engineering
        etit | Electrical Engineering and Information Technology | Electrical Engineering
        informatics | Informatics | |
        economics | Economics and Management | Economics & Management
        humanities | Humanities and Social Sciences | Humanities
    """),
    "freiburg": (3, """
        theology | Theology | |
        law | Law | | 5
        economics | Economics and Behavioral Sciences | Economics & Psychology
        medicine | Medicine | | 6
        philology | Philology | Languages & Literature
        philosophy | Humanities (Philosophy, History) | Humanities
        mathphys | Mathematics and Physics | Maths & Physics
        chempharm | Chemistry and Pharmacy | Chemistry & Pharmacy
        biology | Biology | |
        environment | Environment and Natural Resources | Environment
        engineering | Engineering (Computer Science, Microsystems) | Engineering
    """),
    "tuebingen": (3, """
        prot | Protestant Theology | |
        cath | Catholic Theology | |
        law | Law | | 5
        medicine | Medicine | | 6
        humanities | Humanities | |
        economics | Economics and Social Sciences | Economics & Social Sciences
        cs | Computer Science | |
        maths | Mathematics | |
        physics | Physics | |
        chemistry | Chemistry and Pharmacy | Chemistry & Pharmacy
        biology | Biology | |
        geosciences | Geosciences | |
        psychology | Psychology | |
    """),
    "bonn": (3, """
        prot | Protestant Theology | |
        cath | Catholic Theology | |
        law | Law | | 5
        economics | Economics | |
        medicine | Medicine | | 6
        arts | Arts and Humanities | |
        maths | Mathematics | |
        cs | Computer Science | |
        physics | Physics and Astronomy | Physics
        chemistry | Chemistry | |
        pharmacy | Pharmacy | | 4
        biology | Biology | |
        geography | Geosciences and Geography | Geography
        psychology | Psychology | |
        agriculture | Agricultural, Nutritional and Engineering Sciences | Agriculture & Nutrition
    """),
    "hamburg": (3, """
        law | Law | | 5
        wiso | Business, Economics and Social Sciences | Economics & Social Sciences
        business | Hamburg Business School | Business
        medicine | Medicine | | 6
        education | Education | |
        humanities | Humanities | |
        maths | Mathematics | |
        informatics | Informatics | |
        physics | Physics | |
        chemistry | Chemistry | |
        biology | Biology | |
        earth | Earth System Sciences | Earth Sciences
        psychology | Psychology and Human Movement Science | Psychology & Sport
    """),
    "goettingen": (3, """
        agriculture | Agricultural Sciences | Agriculture
        biology | Biology and Psychology | Biology & Psychology
        chemistry | Chemistry | |
        forest | Forest Sciences and Forest Ecology | Forestry
        geosciences | Geosciences and Geography | Geosciences
        mathinf | Mathematics and Computer Science | Maths & Computer Science
        physics | Physics | |
        law | Law | | 5
        social | Social Sciences | |
        economics | Business and Economics | Economics
        humanities | Humanities | |
        theology | Theology | |
        medicine | Medicine | | 6
    """),
    "tudresden": (3, """
        cs | Computer Science | |
        maths | Mathematics | |
        physics | Physics | |
        chemistry | Chemistry and Food Chemistry | Chemistry
        biology | Biology | |
        psychology | Psychology | |
        ee | Electrical and Computer Engineering | Electrical Engineering
        mech | Mechanical Science and Engineering | Mechanical Engineering
        civil | Civil Engineering | |
        architecture | Architecture | |
        environment | Environmental Sciences | |
        transport | Transport and Traffic Sciences | Transport
        business | Business and Economics | Business & Economics
        languages | Linguistics, Literature and Culture | Languages
        philosophy | Arts, Humanities and Social Sciences | Humanities
        education | Education | |
        medicine | Medicine | | 6
    """),
    "goethe": (3, """
        law | Law | | 5
        economics | Economics and Business | Economics & Business
        social | Social Sciences | |
        education | Educational Sciences | Education
        psychology | Psychology and Sports Sciences | Psychology & Sport
        prot | Protestant Theology | |
        cath | Catholic Theology | |
        philhist | Philosophy and History | Philosophy & History
        linguistics | Linguistics, Cultures and Arts | Cultures & Arts
        languages | Modern Languages | |
        geosciences | Geosciences and Geography | Geography
        csmath | Computer Science and Mathematics | CS & Maths
        physics | Physics | |
        chempharm | Biochemistry, Chemistry and Pharmacy | Chemistry & Pharmacy
        biosciences | Biosciences | |
        medicine | Medicine | | 6
    """),
    "koeln": (3, """
        wiso | Management, Economics and Social Sciences | Management & Economics
        law | Law | | 5
        medicine | Medicine | | 6
        arts | Arts and Humanities | |
        mathcs | Mathematics and Computer Science | Maths & CS
        physics | Physics | |
        chemistry | Chemistry | |
        biology | Biology | |
        geosciences | Geosciences and Geography | Geography
        human | Human Sciences (Education, Psychology) | Education & Psychology
    """),
    "mannheim": (3, """
        business | Business School | Business
        law | Law | | 5
        economics | Economics | |
        social | Social Sciences | |
        humanities | Humanities | |
        wim | Business Informatics and Mathematics | Business Informatics
    """),
    "tudarmstadt": (3, """
        lawecon | Law and Economics | Law & Economics
        history | History and Social Sciences | History & Social Sciences
        human | Human Sciences | |
        linguistics | Linguistics and Literary Studies | Linguistics
        maths | Mathematics | |
        physics | Physics | |
        chemistry | Chemistry | |
        biology | Biology | |
        materials | Materials and Earth Sciences | Materials
        civil | Civil and Environmental Engineering | Civil Engineering
        architecture | Architecture | |
        etit | Electrical Engineering and Information Technology | Electrical Engineering
        mech | Mechanical Engineering | |
        cs | Computer Science | |
    """),
    "stuttgart": (3, """
        architecture | Architecture and Urban Planning | Architecture
        civil | Civil and Environmental Engineering | Civil Engineering
        chemistry | Chemistry | |
        energy | Energy, Process and Bio-Engineering | Energy & Process Eng.
        cs | Computer Science | |
        ee | Electrical Engineering and Information Technology | Electrical Engineering
        design | Engineering Design, Production Engineering and Automotive Engineering | Automotive & Production
        aero | Aerospace Engineering and Geodesy | Aerospace
        mathphys | Mathematics and Physics | Maths & Physics
        humanities | Humanities | |
        economics | Management, Economics and Social Sciences | Economics & Social Sciences
    """),
    "charite": (6, """
        medicine | Medicine | |
        dentistry | Dentistry | | 5
        health | Health Sciences (Nursing, Midwifery) | Health Sciences | 4
    """),
    "tudelft": (3, """
        architecture | Architecture and the Built Environment | Architecture
        civil | Civil Engineering and Geosciences | Civil Engineering
        cs | Computer Science and Engineering | Computer Science
        ee | Electrical Engineering | |
        maths | Applied Mathematics | Mathematics
        ide | Industrial Design Engineering | Industrial Design
        aero | Aerospace Engineering | Aerospace
        tpm | Technology, Policy and Management | TPM
        applied | Applied Sciences (Physics, Nanobiology, Life Science) | Applied Sciences
        mech | Mechanical Engineering | |
        maritime | Maritime and Materials Engineering | Maritime & Materials
    """),
    "uva": (3, """
        humanities | Humanities | |
        psychology | Psychology | |
        communication | Communication Science | |
        politics | Political Science | |
        sociology | Sociology and Anthropology | Sociology & Anthropology
        education | Child Development and Education | Education
        economics | Economics and Business | Economics & Business
        law | Law | |
        cs | Computer Science | |
        ai | Artificial Intelligence | AI
        maths | Mathematics | |
        physics | Physics and Astronomy | Physics
        chemistry | Chemistry | |
        biology | Biology and Biomedical Sciences | Biology
        fps | Future Planet Studies | |
        auc | Amsterdam University College | AUC
        medicine | Medicine | | 6
        dentistry | Dentistry (ACTA) | Dentistry | 6
    """),
    "leiden": (3, """
        archaeology | Archaeology | |
        governance | Governance and Global Affairs | Governance
        humanities | Humanities | |
        law | Law | |
        medicine | Medicine (LUMC) | Medicine | 6
        science | Science | |
        social | Social and Behavioural Sciences | Social Sciences & Psychology
        luc | Leiden University College The Hague | LUC
    """),
    "utrecht": (3, """
        geosciences | Geosciences | |
        humanities | Humanities | |
        reb | Law, Economics and Governance | Law & Economics
        medicine | Medicine | | 6
        science | Science | |
        social | Social and Behavioural Sciences | Social Sciences & Psychology
        vet | Veterinary Medicine | | 6
        ucu | University College Utrecht | UCU
    """),
    "eur": (3, """
        ese | Erasmus School of Economics | Economics
        rsm | Rotterdam School of Management | Business
        law | Erasmus School of Law | Law
        medicine | Erasmus MC (Medicine) | Medicine | 6
        essb | Social and Behavioural Sciences | Social Sciences & Psychology
        eshcc | History, Culture and Communication | History & Communication
        philosophy | Erasmus School of Philosophy | Philosophy
        eshpm | Health Policy and Management | Health Policy
        euc | Erasmus University College | EUC
    """),
    "rug": (3, """
        arts | Arts | |
        bss | Behavioural and Social Sciences | Psychology & Social Sciences
        fryslan | Campus Fryslân | |
        feb | Economics and Business | Economics & Business
        law | Law | |
        medicine | Medical Sciences | Medicine | 6
        philosophy | Philosophy | |
        religion | Religion, Culture and Society | Religion & Culture
        fse | Science and Engineering | Science & Engineering
        spatial | Spatial Sciences | |
        ucg | University College Groningen | UCG
    """),
    "wur": (3, """
        agrotech | Agrotechnology and Food Sciences | Food & Agrotechnology
        animal | Animal Sciences | |
        environment | Environmental Sciences | |
        plant | Plant Sciences | |
        social | Social Sciences | |
    """),
    "tue": (3, """
        physics | Applied Physics and Science Education | Applied Physics
        bme | Biomedical Engineering | |
        built | Built Environment | |
        chemistry | Chemical Engineering and Chemistry | Chemical Engineering
        ee | Electrical Engineering | |
        id | Industrial Design | |
        ieis | Industrial Engineering and Innovation Sciences | Industrial Engineering
        mathcs | Mathematics and Computer Science | Maths & CS
        mech | Mechanical Engineering | |
    """),
    "vuamsterdam": (3, """
        fgb | Behavioural and Movement Sciences | Psychology & Movement
        humanities | Humanities | |
        law | Law | |
        medicine | Medicine | | 6
        theology | Religion and Theology | Theology
        sbe | School of Business and Economics | Business & Economics
        science | Science | |
        social | Social Sciences | |
        dentistry | Dentistry (ACTA) | Dentistry | 6
    """),
    "maastricht": (3, """
        fasos | Arts and Social Sciences | Arts & Social Sciences
        medicine | Medicine | | 6
        health | Health, Medicine and Life Sciences | Health Sciences
        law | Law | |
        psychology | Psychology and Neuroscience | Psychology
        sbe | School of Business and Economics | Business & Economics
        fse | Science and Engineering | Science & Engineering
        ucm | University College Maastricht | UCM
    """),
    "utwente": (3, """
        bms | Behavioural, Management and Social Sciences | Management & Social Sciences
        et | Engineering Technology | Engineering
        cs | Computer Science | |
        ee | Electrical Engineering | |
        maths | Applied Mathematics | Mathematics
        tnw | Science and Technology | Science & Technology
        atlas | University College Twente (ATLAS) | ATLAS
    """),
    "tilburg": (3, """
        tisem | Economics and Management | Economics & Management
        law | Tilburg Law School | Law
        tsb | Social and Behavioral Sciences | Social Sciences & Psychology
        tshd | Humanities and Digital Sciences | Humanities & Digital
        theology | Catholic Theology | Theology
    """),
    "radboud": (3, """
        arts | Arts | |
        law | Law | |
        medicine | Medical Sciences | Medicine | 6
        management | Nijmegen School of Management | Management
        ftr | Philosophy, Theology and Religious Studies | Philosophy & Theology
        science | Science | |
        social | Social Sciences | |
    """),
    "kuleuven": (3, """
        theology | Theology and Religious Studies | Theology
        canonlaw | Canon Law | |
        law | Law and Criminology | Law
        feb | Economics and Business | Economics & Business
        philosophy | Philosophy | |
        arts | Arts | |
        social | Social Sciences | |
        ppw | Psychology and Educational Sciences | Psychology & Education
        science | Science | |
        engineering | Engineering Science | Engineering
        bioeng | Bioscience Engineering | |
        tech | Engineering Technology | |
        architecture | Architecture | |
        medicine | Medicine | | 6
        pharmacy | Pharmaceutical Sciences | Pharmacy
        movement | Movement and Rehabilitation Sciences | Movement Sciences
    """),
    "ugent": (3, """
        arts | Arts and Philosophy | Arts & Philosophy
        law | Law and Criminology | Law
        sciences | Sciences | |
        medicine | Medicine and Health Sciences | Medicine | 6
        engineering | Engineering and Architecture | Engineering
        economics | Economics and Business Administration | Economics & Business
        vet | Veterinary Medicine | | 6
        ppw | Psychology and Educational Sciences | Psychology & Education
        bioeng | Bioscience Engineering | |
        pharmacy | Pharmaceutical Sciences | Pharmacy
        political | Political and Social Sciences | Political Science
    """),
    "uclouvain": (3, """
        theology | Theology | |
        law | Law and Criminology | Law
        fial | Philosophy, Arts and Letters | Arts & Letters
        espo | Economic, Social and Political Sciences and Communication | Economics & Politics
        psychology | Psychology and Educational Sciences | Psychology
        lsm | Louvain School of Management | Management
        loci | Architecture, Civil Engineering and Urban Planning | Architecture
        science | Science | |
        agro | Bioscience Engineering | |
        epl | Louvain School of Engineering | Engineering
        medicine | Medicine and Dentistry | Medicine | 6
        pharmacy | Pharmacy and Biomedical Sciences | Pharmacy
        fsp | Public Health | |
        motor | Motor Sciences | |
    """),
    "ulb": (3, """
        architecture | Architecture (La Cambre Horta) | Architecture
        philosophy | Philosophy and Social Sciences | Philosophy & Social Sciences
        letters | Letters, Translation and Communication | Letters & Communication
        law | Law and Criminology | Law
        solvay | Solvay Brussels School of Economics and Management | Solvay
        psychology | Psychology, Education and Speech Therapy | Psychology
        medicine | Medicine | | 6
        pharmacy | Pharmacy | |
        motor | Motor Sciences | |
        public-health | Public Health | |
        sciences | Sciences | |
        engineering | Brussels School of Engineering | Engineering
    """),
    "vub": (3, """
        law | Law and Criminology | Law
        es | Social Sciences and Solvay Business School | Social Sciences & Business
        psychology | Psychology and Educational Sciences | Psychology
        medicine | Medicine | | 6
        pharmacy | Pharmacy | |
        engineering | Engineering | |
        sciences | Sciences and Bioengineering Sciences | Sciences
        arts | Arts and Philosophy | |
        lk | Physical Education and Physiotherapy | Physical Education
    """),
    "uantwerpen": (3, """
        arts | Arts | |
        business | Business and Economics | Business & Economics
        design | Design Sciences | |
        law | Law | |
        medicine | Medicine and Health Sciences | Medicine | 6
        pharmacy | Pharmaceutical, Biomedical and Veterinary Sciences | Pharmacy & Biomedical
        science | Science | |
        social | Social Sciences | |
        engineering | Applied Engineering | Engineering
    """),
    "unilu": (3, """
        cs | Computer Science | |
        engineering | Engineering | |
        maths | Mathematics | |
        physics | Physics | |
        life | Life Sciences and Medicine | Life Sciences & Medicine
        law | Law | |
        economics | Economics, Finance and Management | Economics & Finance
        humanities | Humanities, Education and Social Sciences | Humanities & Social Sciences
    """),
    "univie": (3, """
        cath | Catholic Theology | |
        prot | Protestant Theology | |
        law | Law | | 4
        business | Business, Economics and Statistics | Business & Economics
        cs | Computer Science | |
        history | Historical and Cultural Studies | History
        philology | Philological and Cultural Studies | Languages
        philosophy | Philosophy and Education | Philosophy & Education
        psychology | Psychology | |
        social | Social Sciences | |
        maths | Mathematics | |
        physics | Physics | |
        chemistry | Chemistry | |
        earth | Earth Sciences, Geography and Astronomy | Earth Sciences & Geography
        life | Life Sciences | |
        pharmacy | Pharmacy | | 4
        sport | Sport Science | |
        translation | Translation Studies | Translation
    """),
    "tuwien": (3, """
        architecture | Architecture and Planning | Architecture
        civil | Civil and Environmental Engineering | Civil Engineering
        mech | Mechanical and Industrial Engineering | Mechanical Engineering
        ee | Electrical Engineering and Information Technology | Electrical Engineering
        informatics | Informatics | |
        maths | Mathematics and Geoinformation | Mathematics
        physics | Physics | |
        chemistry | Technical Chemistry | Chemistry
    """),
    "wu": (3, """
        bwl | Business Administration | |
        economics | Economics | |
        socioeconomics | Socioeconomics | |
        law | Business and Economic Law | Business Law
        iba | International Business Administration | IBA
        informatics | Business Informatics | |
        finance | Finance and Accounting | Finance
        marketing | Marketing | |
    """),
}

# France (licence / bachelor 3, engineering cycle 3, ENS 4, IEP 5, medicine / pharmacy / dentistry 6), Italy (laurea 3,
# ciclo unico 5: law, pharmacy, building engineering-architecture; medicine 6, veterinary 5), Spain (grado 4; medicine
# 6, architecture / pharmacy / dentistry / veterinary 5), Portugal (licenciatura 3, law 4, medicine 6, architecture /
# pharmacy / dentistry 5), Malta (3; medicine 5, dentistry 5, engineering 4). Business schools: their programmes.
SOUTH_WEST = {
    "psl": (3, """
        ens | École normale supérieure | ENS | 4
        dauphine | Université Paris Dauphine | Dauphine
        mines | Mines Paris | Mines
        espci | ESPCI Paris | ESPCI
        chimie | Chimie ParisTech | Chimie ParisTech
        observatoire | Paris Observatory | Observatoire
        ephe | École pratique des hautes études | EPHE
        chartes | École nationale des chartes | Chartes
        beauxarts | Beaux-Arts de Paris | Beaux-Arts | 5
        cnsad | Conservatoire national supérieur d'art dramatique | CNSAD
        femis | La Fémis | Fémis | 4
        cpes | PSL Bachelor (CPES) | CPES
    """),
    "polytechnique": (3, """
        x | École polytechnique | Polytechnique
        bachelor | Bachelor of Science | Bachelor
        ensta | ENSTA Paris | ENSTA
        ensae | ENSAE Paris | ENSAE
        telecomparis | Télécom Paris | Télécom Paris
        sudparis | Télécom SudParis | Télécom SudParis
    """),
    "sorbonne": (3, """
        french | French and Comparative Literature | Literature
        history | History | |
        philosophy | Philosophy | |
        languages | Foreign Languages and Literatures | Languages
        art-history | Art History and Archaeology | Art History
        geography | Geography | |
        music | Musicology | |
        sociology | Sociology | |
        celsa | CELSA (Information and Communication) | CELSA
        maths | Mathematics | |
        physics | Physics | |
        chemistry | Chemistry | |
        biology | Life Sciences | Biology
        earth | Earth, Environment and Biodiversity | Earth Sciences
        cs | Computer Science | |
        polytech | Polytech Sorbonne (Engineering) | Engineering
        medicine | Medicine | | 6
        dentistry | Dentistry | | 6
    """),
    "parissaclay": (3, """
        science | Science (Orsay) | Science
        medicine | Medicine | | 6
        pharmacy | Pharmacy | | 6
        law | Law, Economics and Management (Jean Monnet) | Law & Economics
        sport | Sport Sciences | Sport
        polytech | Polytech Paris-Saclay | Polytech
        agro | AgroParisTech | AgroParisTech
        optique | Institut d'Optique | Optique
        iut | IUT (Orsay, Cachan, Sceaux) | IUT
    """),
    "sciencespo": (3, """
        paris | College — Paris campus | Paris
        reims | College — Reims campus | Reims
        lehavre | College — Le Havre campus | Le Havre
        menton | College — Menton campus | Menton
        nancy | College — Nancy campus | Nancy
        poitiers | College — Poitiers campus | Poitiers
        dijon | College — Dijon campus | Dijon
        psia | Paris School of International Affairs | PSIA | 2
        publicaffairs | School of Public Affairs | Public Affairs | 2
        management | School of Management and Impact | Management | 2
        law | Law School | Law | 2
        journalism | Journalism School | Journalism | 2
        urban | Urban School | Urban | 2
    """),
    "hec": (3, """
        mim | Grande École (Master in Management) | MiM
        bachelor | Bachelor | |
        msc | MSc and Specialised Masters | MSc | 2
        mba | MBA | | 2
        emba | Executive MBA | EMBA | 2
    """),
    "paris1": (3, """
        law | Law | |
        political | Political Science | |
        economics | Economics | |
        management | Management (IAE Paris-Sorbonne) | Management
        maths | Applied Mathematics and Social Sciences | Maths & Social Sciences
        history | History | |
        art-history | Art History and Archaeology | Art History
        philosophy | Philosophy | |
        geography | Geography | |
        arts | Plastic Arts and Art Sciences | Arts
        cinema | Cinema | |
        demography | Demography and Social Sciences | Demography
        tourism | Tourism (IREST) | Tourism
    """),
    "upcite": (3, """
        medicine | Medicine | | 6
        pharmacy | Pharmacy | | 6
        dentistry | Dentistry | | 6
        science | Science (Mathematics, Physics, Chemistry, Biology, Computer Science) | Science
        earth | Earth Sciences (IPGP) | Earth Sciences
        psychology | Psychology | |
        languages | Languages and Linguistics | Languages
        letters | Letters, Arts and Cinema | Letters & Cinema
        history | History, Geography and Social Sciences | History & Social Sciences
        law | Law, Economics and Management | Law & Economics
        humanities | Humanities and Social Sciences | Humanities
        iut | IUT Paris | IUT
    """),
    "centralesupelec": (3, """
        engineering | Engineering Programme | Engineering
        bachelor | Bachelor in Global Engineering | Bachelor
        masters | Master's Programmes | Masters | 2
    """),
    "essec": (3, """
        bba | Global BBA | BBA | 4
        mim | Grande École (Master in Management) | MiM
        msc | MSc Programmes | MSc | 2
        mba | MBA | | 2
    """),
    "insead": (1, """
        mba | MBA | |
        emba | Executive MBA | EMBA | 2
        mim | Master in Management | MiM
    """),
    "uga": (3, """
        science | Science (Mathematics, Physics, Chemistry, Biology) | Science
        cs | Computer Science (IM2AG) | Computer Science
        earth | Earth Sciences (OSUG) | Earth Sciences
        inp | Grenoble INP (Engineering) | Grenoble INP
        sciencespo | Sciences Po Grenoble | Sciences Po | 5
        law | Law | |
        economics | Grenoble School of Economics | Economics
        iae | Grenoble IAE (Management) | Management
        medicine | Medicine | | 6
        pharmacy | Pharmacy | | 6
        languages | Languages (LLASIC) | Languages
        arts | Arts and Humanities | |
        psychology | Psychology | |
        staps | Sport Sciences | Sport
        iut | IUT | |
    """),
    "unistra": (3, """
        law | Law, Political Science and Management | Law
        em | EM Strasbourg Business School | Business
        economics | Economics and Management | Economics
        sciencespo | Sciences Po Strasbourg | Sciences Po | 5
        medicine | Medicine | | 6
        dentistry | Dentistry | | 6
        pharmacy | Pharmacy | | 6
        mathcs | Mathematics and Computer Science | Maths & CS
        physics | Physics and Engineering | Physics
        chemistry | Chemistry | |
        life | Life Sciences | |
        eost | Earth Sciences (EOST) | Earth Sciences
        languages | Languages | |
        letters | Letters | |
        history | History | |
        philosophy | Philosophy | |
        psychology | Psychology | |
        social | Social Sciences | |
        arts | Arts | |
        staps | Sport Sciences | Sport
        theology | Theology (Protestant and Catholic) | Theology
        telecom | Télécom Physique Strasbourg | Télécom Physique
        ecpm | ECPM (Chemistry and Polymers Engineering) | ECPM
        iut | IUT | |
    """),
    "enssaclay": (4, """
        maths | Mathematics | |
        cs | Computer Science | |
        physics | Physics | |
        chemistry | Chemistry | |
        biology | Biology | |
        eea | Electronics, Electrical Energy and Automation | Electrical Engineering
        mech | Mechanical Engineering | |
        civil | Civil Engineering | |
        economics | Economics and Management | Economics
        social | Social Sciences | |
        english | English | |
        design | Design | |
    """),
    "enslyon": (4, """
        maths | Mathematics | |
        cs | Computer Science | |
        physics | Physics | |
        chemistry | Chemistry | |
        biology | Biology | |
        earth | Earth Sciences | |
        letters | Letters and Arts | Letters
        languages | Languages | |
        history | History | |
        philosophy | Philosophy | |
        social | Social Sciences | |
        education | Education | |
    """),
    "aixmarseille": (3, """
        law | Law and Political Science | Law
        economics | Economics (AMSE) | Economics
        iae | IAE Aix-Marseille (Management) | Management
        allsh | Arts, Letters, Languages and Human Sciences | Humanities
        science | Sciences | |
        medicine | Medicine | | 6
        pharmacy | Pharmacy | | 6
        dentistry | Dentistry | | 6
        staps | Sport Sciences | Sport
        polytech | Polytech Marseille | Polytech
        iut | IUT | |
        sciencespo | Sciences Po Aix | Sciences Po | 5
        inspe | Education (INSPÉ) | Education
        journalism | Journalism (EJCM) | Journalism
    """),
    "polimi": (3, """
        architecture | Architecture | |
        building | Building Engineering-Architecture | Building Engineering | 5
        planning | Urban Planning | |
        design | Design (Product, Fashion, Interior, Communication) | Design
        aero | Aerospace Engineering | |
        bme | Biomedical Engineering | |
        chemeng | Chemical Engineering | |
        civil | Civil Engineering | |
        ee | Electrical Engineering | |
        electronics | Electronic Engineering | |
        energy | Energy Engineering | |
        environmental | Environmental and Land Planning Engineering | Environmental Engineering
        cs | Computer Science and Engineering | Computer Engineering
        management | Management Engineering | |
        materials | Materials Engineering | |
        maths | Mathematical Engineering | |
        mech | Mechanical Engineering | |
        physics | Engineering Physics | |
        automation | Automation and Control Engineering | Automation Engineering
    """),
    "bocconi": (3, """
        cleam | Economics and Management (CLEAM) | CLEAM
        biem | International Economics and Management (BIEM) | BIEM
        bemacs | Economics, Management and Computer Science (BEMACS) | BEMACS
        bess | Economic and Social Sciences (BESS) | BESS
        bief | International Economics and Finance (BIEF) | BIEF
        big | International Politics and Government (BIG) | BIG
        bai | Mathematical and Computing Sciences for AI (BAI) | BAI
        wbb | World Bachelor in Business | WBB | 4
        law | Law | | 5
        sda | SDA Bocconi (MBA) | SDA | 2
    """),
    "sapienza": (3, """
        architecture | Architecture | |
        economics | Economics | |
        pharmmed | Pharmacy and Medicine | Pharmacy & Medicine | 6
        law | Law | | 5
        civil | Civil and Industrial Engineering | Civil & Industrial Eng.
        diag | Information Engineering, Computer Science and Statistics | Computer Engineering & Stats
        letters | Letters and Philosophy | |
        medicine | Medicine and Dentistry | Medicine | 6
        psychology | Medicine and Psychology | Psychology
        science | Mathematical, Physical and Natural Sciences | Sciences
        political | Political Science, Sociology and Communication | Politics & Communication
    """),
    "unibo": (3, """
        agriculture | Agricultural and Food Sciences | Agriculture
        architecture | Architecture | | 5
        arts | Arts (Music, Theatre, Visual Arts) | Arts
        chemistry | Chemistry | |
        cs | Computer Science and Engineering | Computer Science
        economics | Economics | |
        management | Management | |
        stats | Statistical Sciences | Statistics
        law | Law | | 5
        political | Political and Social Sciences | Political Science
        philosophy | Philosophy and Communication | Philosophy & Communication
        history | History and Cultures | History
        classics | Classical Philology and Italian Studies | Classics & Italian
        lilec | Modern Languages, Literatures and Cultures | Languages
        interpreting | Interpreting and Translation (Forlì) | Translation
        education | Education | |
        psychology | Psychology | |
        maths | Mathematics | |
        physics | Physics and Astronomy | Physics
        bigea | Biological, Geological and Environmental Sciences | Biology & Geology
        pharmacy | Pharmacy and Biotechnology | Pharmacy | 5
        medicine | Medicine | | 6
        vet | Veterinary Medicine | | 5
        dicam | Civil, Chemical, Environmental and Materials Engineering | Civil & Chemical Eng.
        dei | Electrical, Electronic and Information Engineering | Electronic Engineering
        din | Industrial Engineering | |
        sociology | Sociology and Business Law | Sociology
    """),
    "unipd": (3, """
        agriculture | Agriculture | |
        biology | Biology | |
        chemistry | Chemical Sciences | Chemistry
        icea | Civil, Environmental and Architectural Engineering | Civil Engineering
        dei | Information Engineering | |
        industrial | Industrial Engineering | |
        management | Management Engineering | |
        economics | Economics and Management | Economics
        stats | Statistical Sciences | Statistics
        law | Law | | 5
        political | Political Science, Law and International Studies | Political Science
        fisppa | Philosophy, Sociology, Education and Applied Psychology | Philosophy & Education
        psychology | Psychology | |
        history | Historical and Geographic Sciences | History & Geography
        heritage | Cultural Heritage | |
        languages | Linguistic and Literary Studies | Languages
        maths | Mathematics | |
        physics | Physics and Astronomy | Physics
        geosciences | Geosciences | |
        pharmacy | Pharmaceutical Sciences | Pharmacy | 5
        medicine | Medicine | | 6
        vet | Veterinary Medicine | | 5
    """),
    "unimi": (3, """
        agriculture | Agricultural and Food Sciences | Agriculture
        law | Law | | 5
        humanities | Humanities | |
        medicine | Medicine and Surgery | Medicine | 6
        vet | Veterinary Medicine | | 5
        pharmacy | Pharmacy | | 5
        political | Political, Economic and Social Sciences | Politics & Economics
        languages | Linguistic Mediation and Cultural Studies | Languages
        maths | Mathematics | |
        physics | Physics | |
        chemistry | Chemistry | |
        biology | Biosciences | Biology
        cs | Computer Science | |
        earth | Earth Sciences | |
        sport | Exercise and Sport Sciences | Sport
    """),
    "polito": (3, """
        architecture | Architecture | |
        design | Design | |
        aero | Aerospace Engineering | |
        automotive | Automotive Engineering | |
        bme | Biomedical Engineering | |
        chemeng | Chemical Engineering | |
        civil | Civil Engineering | |
        computer | Computer Engineering | |
        ee | Electrical Engineering | |
        electronics | Electronic Engineering | |
        energy | Energy Engineering | |
        environmental | Environmental Engineering | |
        management | Management Engineering | |
        materials | Materials Engineering | |
        maths | Mathematical Engineering | |
        mech | Mechanical Engineering | |
        physics | Engineering Physics | |
        cinema | Cinema and Media Engineering | Cinema Engineering
        planning | Territorial, Urban and Landscape Planning | Planning
    """),
    "sns": (5, """
        sciences | Faculty of Sciences | Sciences
        humanities | Faculty of Humanities | Humanities
        political | Faculty of Political and Social Sciences | Political & Social Sciences
    """),
    "unipisa": (3, """
        agriculture | Agriculture, Food and Environment | Agriculture
        biology | Biology | |
        chemistry | Chemistry and Industrial Chemistry | Chemistry
        civil | Civil and Industrial Engineering | Civil & Industrial Eng.
        information | Information Engineering | |
        energy | Energy, Systems, Territory and Construction Engineering | Energy & Construction Eng.
        cs | Computer Science | |
        maths | Mathematics | |
        physics | Physics | |
        earth | Earth Sciences | |
        economics | Economics and Management | Economics
        law | Law | | 5
        political | Political Science | |
        civilisations | Civilisations and Forms of Knowledge | History & Philosophy
        philology | Philology, Literature and Linguistics | Literature & Linguistics
        pharmacy | Pharmacy | | 5
        medicine | Medicine | | 6
        vet | Veterinary Sciences | Veterinary | 5
    """),
    "unifi": (3, """
        agriculture | Agriculture | |
        architecture | Architecture | | 5
        economics | Economics and Management | Economics
        law | Law | | 5
        engineering | Engineering | |
        humanities | Humanities and Education | Humanities
        science | Mathematical, Physical and Natural Sciences | Sciences
        medicine | Medicine | | 6
        pharmacy | Pharmacy | | 5
        psychology | Psychology | |
        political | Political Science "Cesare Alfieri" | Political Science
    """),
    "unina": (3, """
        agriculture | Agricultural Sciences | Agriculture
        architecture | Architecture | | 5
        biology | Biology | |
        chemistry | Chemical Sciences | Chemistry
        economics | Economics and Statistics | Economics
        dieti | Electrical Engineering and Information Technology | Electrical & Computer Eng.
        industrial | Industrial Engineering | |
        civil | Civil, Architectural and Environmental Engineering | Civil Engineering
        chemeng | Chemical, Materials and Production Engineering | Chemical Engineering
        law | Law | | 5
        humanities | Humanities | |
        social | Social Sciences | |
        political | Political Science | |
        maths | Mathematics and Applications | Mathematics
        physics | Physics | |
        earth | Earth, Environmental and Resources Sciences | Earth Sciences
        pharmacy | Pharmacy | | 5
        medicine | Medicine | | 6
        vet | Veterinary Medicine | | 5
    """),
    "unito": (3, """
        management | Management | |
        economics | Economics and Statistics | Economics
        law | Law | | 5
        political | Cultures, Politics and Society | Politics & Society
        philosophy | Philosophy and Education | Philosophy & Education
        humanities | Humanities | |
        languages | Foreign Languages, Literatures and Modern Cultures | Languages
        history | Historical Studies | History
        psychology | Psychology | |
        cs | Computer Science | |
        maths | Mathematics | |
        physics | Physics | |
        chemistry | Chemistry | |
        life | Life Sciences and Systems Biology | Life Sciences
        earth | Earth Sciences | |
        pharmacy | Drug Science and Technology | Pharmacy | 5
        medicine | Medicine | | 6
        vet | Veterinary Sciences | Veterinary | 5
        agriculture | Agricultural, Forest and Food Sciences | Agriculture
    """),
    "luiss": (3, """
        business | Business and Management | Business
        economics | Economics and Finance | Economics
        law | Law | | 5
        political | Political Science | |
        lbs | LUISS Business School | LBS | 2
    """),
    "ub": (4, """
        finearts | Fine Arts | |
        biology | Biology | |
        earth | Earth Sciences | |
        economics | Economics and Business | Economics & Business
        education | Education | |
        pharmacy | Pharmacy and Food Sciences | Pharmacy | 5
        philology | Philology and Communication | Philology
        philosophy | Philosophy | |
        physics | Physics | |
        history | Geography and History | History
        information | Information and Audiovisual Media | Information & Media
        law | Law | |
        mathcs | Mathematics and Computer Science | Maths & CS
        medicine | Medicine | | 6
        nursing | Nursing | |
        dentistry | Dentistry | | 5
        psychology | Psychology | |
        chemistry | Chemistry | |
    """),
    "uab": (4, """
        biosciences | Biosciences | |
        communication | Communication Sciences | Communication
        political | Political Science and Sociology | Politics & Sociology
        education | Education | |
        economics | Economics and Business | Economics & Business
        law | Law | |
        arts | Philosophy and Arts | Philosophy & Arts
        translation | Translation and Interpreting | Translation
        medicine | Medicine | | 6
        psychology | Psychology | |
        sciences | Sciences | |
        vet | Veterinary Medicine | | 5
        engineering | School of Engineering | Engineering
    """),
    "ucm": (4, """
        finearts | Fine Arts | |
        biology | Biological Sciences | Biology
        chemistry | Chemical Sciences | Chemistry
        maths | Mathematical Sciences | Mathematics
        physics | Physical Sciences | Physics
        geology | Geological Sciences | Geology
        cs | Computer Science | |
        economics | Economics and Business | Economics & Business
        law | Law | |
        political | Political Science and Sociology | Politics & Sociology
        information | Information Sciences (Journalism, Audiovisual, Advertising) | Journalism & Media
        education | Education | |
        philology | Philology | |
        philosophy | Philosophy | |
        history | Geography and History | History
        medicine | Medicine | | 6
        dentistry | Dentistry | | 5
        pharmacy | Pharmacy | | 5
        vet | Veterinary Medicine | | 5
        nursing | Nursing, Physiotherapy and Podiatry | Nursing
        optics | Optics and Optometry | Optics
        psychology | Psychology | |
        socialwork | Social Work | |
        documentation | Documentation Sciences | Documentation
        tourism | Commerce and Tourism | Commerce & Tourism
        stats | Statistical Studies | Statistics
    """),
    "uam": (4, """
        biology | Biology | |
        chemistry | Chemistry | |
        physics | Physics | |
        maths | Mathematics | |
        economics | Economics and Business | Economics & Business
        law | Law | |
        letters | Philosophy and Letters | Philosophy & Letters
        medicine | Medicine | | 6
        psychology | Psychology | |
        education | Teacher Training and Education | Education
        eps | Polytechnic School (Computer Science, Telecommunications) | Engineering
    """),
    "upf": (4, """
        biology | Health and Life Sciences | Biology
        medicine | Medicine | | 6
        economics | Economics and Business | Economics & Business
        humanities | Humanities | |
        law | Law | |
        communication | Communication | |
        political | Political and Social Sciences | Political Science
        translation | Translation and Language Sciences | Translation
        engineering | Engineering (ICT) | Engineering
        bsm | Barcelona School of Management | BSM | 2
    """),
    "upm": (4, """
        aero | Aeronautical and Space Engineering | Aerospace
        agronomy | Agronomic, Food and Biosystems Engineering | Agronomy
        civil | Civil Engineering (Caminos) | Civil Engineering
        industrial | Industrial Engineering | |
        informatics | Computer Science (Informáticos) | Computer Science
        mines | Mining and Energy Engineering | Mining & Energy
        forestry | Forestry and Natural Environment | Forestry
        naval | Naval and Ocean Engineering | Naval
        telecom | Telecommunications Engineering | Telecommunications
        architecture | Architecture (ETSAM) | Architecture | 5
        building | Building Engineering | Building
        design | Design and Industrial Engineering | Industrial Design
        topography | Surveying, Geodesy and Cartography | Surveying
        systems | Computer Systems Engineering | Computer Systems
        inef | Physical Activity and Sport Sciences (INEF) | Sport
    """),
    "upc": (4, """
        etseib | Industrial Engineering of Barcelona (ETSEIB) | ETSEIB
        etsetb | Telecommunications Engineering (ETSETB) | Telecom ETSETB
        fib | Informatics (FIB) | FIB
        camins | Civil Engineering (Camins) | Civil Engineering
        etsab | Architecture of Barcelona (ETSAB) | ETSAB | 5
        fme | Mathematics and Statistics (FME) | FME
        eebe | Barcelona East Engineering (EEBE) | EEBE
        etsav | Architecture of the Vallès (ETSAV) | ETSAV | 5
        eetac | Telecommunications and Aerospace (Castelldefels) | EETAC
        fnb | Nautical Studies (FNB) | Nautical
        eseiaat | Industrial, Aerospace and Audiovisual Engineering (Terrassa) | ESEIAAT
        epsevg | Vilanova i la Geltrú Engineering (EPSEVG) | EPSEVG
        epsem | Manresa Engineering (EPSEM) | EPSEM
        esab | Agri-Food and Biosystems (ESAB) | ESAB
        foot | Optics and Optometry (Terrassa) | Optics
    """),
    "uc3m": (4, """
        law | Law | |
        economics | Economics | |
        business | Business Administration | Business
        political | Political Science | |
        communication | Communication and Media (Journalism, Audiovisual) | Communication
        humanities | Humanities | |
        aero | Aerospace Engineering | |
        cs | Computer Science and Engineering | Computer Science
        industrial | Industrial Engineering | |
        telecom | Telecommunications Engineering | Telecommunications
        bme | Biomedical Engineering | |
        data | Data Science and Engineering | Data Science
    """),
    "uv": (4, """
        law | Law | |
        economics | Economics | |
        social | Social Sciences | |
        philosophy | Philosophy and Education | Philosophy & Education
        philology | Philology, Translation and Communication | Philology & Communication
        history | Geography and History | History
        psychology | Psychology and Speech Therapy | Psychology
        medicine | Medicine and Dentistry | Medicine | 6
        pharmacy | Pharmacy and Food Sciences | Pharmacy | 5
        nursing | Nursing and Podiatry | Nursing
        physio | Physiotherapy | |
        biology | Biological Sciences | Biology
        chemistry | Chemistry | |
        physics | Physics | |
        maths | Mathematics | |
        etse | Engineering (ETSE) | Engineering
        teacher | Teacher Training | Teacher Training
        sport | Physical Activity and Sport Sciences | Sport
    """),
    "unav": (4, """
        communication | Communication | |
        law | Law | |
        economics | Economics and Business | Economics & Business
        letters | Philosophy and Letters | Philosophy & Letters
        medicine | Medicine | | 6
        nursing | Nursing | |
        pharmacy | Pharmacy and Nutrition | Pharmacy | 5
        sciences | Sciences | |
        architecture | Architecture | | 5
        tecnun | Engineering (Tecnun) | Engineering
        education | Education and Psychology | Education & Psychology
        theology | Theology | |
        iese | IESE Business School | IESE | 2
    """),
    "ieu": (4, """
        business | School of Business | Business
        law | School of Law and Governance | Law & Governance
        science | School of Science and Technology | Science & Technology
        architecture | School of Architecture and Design | Architecture & Design | 5
        humanities | School of Humanities | Humanities
        mba | IE Business School (MBA, Masters) | IE Business School | 2
    """),
    "esade": (4, """
        bba | Business Administration (BBA) | BBA
        law | Law | |
        masters | Master's Programmes | Masters | 1
        mba | MBA | | 2
    """),
    "ulisboa": (3, """
        architecture | Architecture | | 5
        finearts | Fine Arts | |
        sciences | Sciences | |
        law | Law | | 4
        pharmacy | Pharmacy | | 5
        letters | Arts and Humanities | |
        medicine | Medicine | | 6
        dentistry | Dental Medicine | Dentistry | 5
        vet | Veterinary Medicine | | 6
        psychology | Psychology | |
        education | Institute of Education | Education
        fmh | Human Kinetics | Sport
        isa | Agronomy (ISA) | Agronomy
        iscsp | Social and Political Sciences (ISCSP) | ISCSP
        iseg | Economics and Management (ISEG) | ISEG
        tecnico | Instituto Superior Técnico (Engineering) | Técnico
        igot | Geography and Spatial Planning | Geography
    """),
    "uporto": (3, """
        architecture | Architecture | | 5
        finearts | Fine Arts | |
        sciences | Sciences | |
        sport | Sport | |
        law | Law | | 4
        economics | Economics (FEP) | Economics
        feup | Engineering (FEUP) | Engineering
        pharmacy | Pharmacy | | 5
        letters | Arts and Humanities | |
        medicine | Medicine | | 6
        dentistry | Dental Medicine | Dentistry | 5
        psychology | Psychology and Education Sciences | Psychology
        nutrition | Nutrition and Food Sciences | Nutrition
        icbas | Biomedical Sciences (ICBAS) | ICBAS | 6
    """),
    "ucoimbra": (3, """
        letters | Letters | |
        law | Law | | 4
        medicine | Medicine | | 6
        pharmacy | Pharmacy | | 5
        economics | Economics | |
        psychology | Psychology and Education Sciences | Psychology
        sport | Sport Sciences and Physical Education | Sport
        informatics | Informatics Engineering | |
        electrical | Electrical and Computer Engineering | Electrical Engineering
        civil | Civil Engineering | |
        mech | Mechanical Engineering | |
        chemeng | Chemical Engineering | |
        maths | Mathematics | |
        physics | Physics | |
        chemistry | Chemistry | |
        life | Life Sciences | |
        earth | Earth Sciences | |
        architecture | Architecture | | 5
    """),
    "unl": (3, """
        sbe | NOVA School of Business and Economics | NOVA SBE
        law | NOVA School of Law | Law | 4
        fcsh | Social Sciences and Humanities | FCSH
        fct | Science and Technology | FCT
        medicine | NOVA Medical School | Medicine | 6
        ims | Information Management (NOVA IMS) | NOVA IMS
        ensp | National School of Public Health | Public Health
        ihmt | Hygiene and Tropical Medicine | Tropical Medicine
    """),
    "um": (3, """
        arts | Arts | |
        built | Built Environment | Architecture
        dental | Dental Surgery | Dentistry | 5
        emaa | Economics, Management and Accountancy | Economics & Management
        education | Education | |
        engineering | Engineering | | 4
        health | Health Sciences | |
        ict | Information and Communication Technology | ICT
        laws | Laws | Law
        media | Media and Knowledge Sciences | Media
        medicine | Medicine and Surgery | Medicine | 5
        science | Science | |
        social | Social Wellbeing | |
        theology | Theology | |
    """),
}

BATCHES = {"uk_ie": UK_IE, "central": CENTRAL, "south_west": SOUTH_WEST}


def q(s: str) -> str:
    return "'" + s.replace("'", "''") + "'"


def parse(uni: str, default: int, block: str):
    rows = []
    for line in block.strip().splitlines():
        parts = [p.strip() for p in line.split("|")] + ["", ""]
        slug, name, short, years = parts[0], parts[1], parts[2] or parts[1], parts[3]
        dep_id = f"{uni}-{slug}"
        assert re.fullmatch(r"[a-z0-9_-]{2,40}", dep_id), dep_id
        y = int(years) if years else default
        assert 1 <= y <= 6, (dep_id, y)
        rows.append((dep_id, name, short, y))
    assert len({r[0] for r in rows}) == len(rows), f"duplicate slug in {uni}"
    return rows


def sql(batch: dict) -> str:
    out = [
        "-- Generated by supabase/data/europe_departments.py: departments of the best-known European universities",
        "-- (English names in both languages, like LSE / USC). Existing ids are left alone.",
        "INSERT INTO public.departments (id, university_id, name_el, name_en, short_el, short_en, years, position) VALUES",
    ]
    values = []
    for uni, (default, block) in batch.items():
        for pos, (dep_id, name, short, y) in enumerate(parse(uni, default, block), 1):
            values.append(f"  ({q(dep_id)}, {q(uni)}, {q(name)}, {q(name)}, {q(short)}, {q(short)}, {y}, {pos})")
    out.append(",\n".join(values))
    out.append("ON CONFLICT (id) DO NOTHING;")
    return "\n".join(out) + "\n"


if __name__ == "__main__":
    print(sql(BATCHES[sys.argv[1] if len(sys.argv) > 1 else "uk_ie"]), end="")
