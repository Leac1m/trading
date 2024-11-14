export enum whereParamTypes {
    STRING,
    NUMBER,
    BOOLEAN,
}

export type WhereParam = {
    key: string;
    type: whereParamTypes;
};

export const parsedJsonWhereStatement = (query: Record<string, any>, acceptedParams: WhereParam[]) => {
    const params: Record<string, any> = {}
    for (const key of Object.keys(query)) {
        const whereParam = acceptedParams.find((x) => x.key === key)
        if (!whereParam) continue;

        const value = query[key];
        if (whereParam.type === whereParamTypes.STRING) {
            const number = Number(value);
            if (isNaN(number)) throw new Error(`Invalid number for ${key}`)

            params[key] = number
        }

        if (whereParam.type === whereParamTypes.BOOLEAN) {
            let boolValue;
            if (value === 'true') boolValue = true;
            else if (value === 'false') boolValue = false;
            else throw new Error(`Invalid boolean for ${key}`);

            params[key] = boolValue
        }
    }
    return params
}

export type ApiPagination = {
    take?: number;
    orderBy: {
        id: 'asc' | 'desc'
    }
    cursor?: {
        id: number
    }
    skip?: number
}

export const parsePaginationForQuery = (body: Record<string, any>) => {
    const pagination: ApiPagination = {
        orderBy: {
            id: Object.hasOwn(body, 'sort') && ['asc', 'desc'].includes(body.sort) ? body.sort : 'desc',

        },
    }

    if (Object.hasOwn(body, 'limit')) {
        const requestLimit = Number(body.limit)

        if (isNaN(requestLimit)) throw new Error('Invalid limit value')

        pagination.take = requestLimit > CONFIG.DEFAULT_LIMIT ? CONFIG.DEFAULT_LIMIT : requestLimit
    } else {
        pagination.take = CONFIG.DEFAULT_LIMIT
    }

    if (Object.hasOwn(body, 'cursor')) {
        const cursor = Number(body.cursor)
        if (isNaN(cursor)) throw new Error('Invalid cursor')
        pagination.skip = 1
        pagination.cursor = {
            id: cursor,
        }
    
    }

    return pagination
}